require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const admin = require("firebase-admin"); // បន្ថែមគ្រឿងផ្សំសម្ងាត់

const viewRoutes = require("./routes/viewRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const historyRoutes = require("./routes/history");

// ២. ចុះឈ្មោះផ្លូវមេ (Prefix)
// បើប្អូនដាក់ '/history' នៅទីនេះ...
const aiHandler = require("./controllers/aiController");
const User = require("./models/User");

// --- ១. កំណត់រចនាសម្ព័ន្ធ Firebase Admin (ប្តូរមកប្រើ Environment Variables) ---
// ឈប់ប្រើ require File JSON ទៀតហើយ ដើម្បីការពារការ Crash

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // 💡 ចំណុចសំខាន់៖ ត្រូវប្តូរ \\n ទៅជា \n ពិតប្រាកដ ដើម្បីឱ្យ Firebase ស្គាល់ Key
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
    });
    console.log("✅ Firebase Admin Initialized via Environment Variables");
  } catch (error) {
    console.error("❌ Firebase Initialization Error:", error.message);
  }
}

const app = express();
const server = http.createServer(app);
// កែសម្រួលកូដរបស់បងមកបែបនេះ៖
const io = new Server(server, {
  cors: { origin: "*" },
maxHttpBufferSize: 1e8,
});

// --- ២. Middleware កំពូលសុវត្ថិភាព ---
app.use(express.json()); // អាន idToken ពី frontend
app.use(express.urlencoded({ extended: true }));

// បន្ថែម Header ការពារការបិទ Popup របស់ Google
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "neural_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }),
);

// --- ៣. Middleware ចម្លងទិន្នន័យ User ទៅកាន់គ្រប់ View ---
app.use(async (req, res, next) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      res.locals.user = user;
    } else {
      res.locals.user = null;
    }
    next();
  } catch (err) {
    next(err);
  }
});

app.use(
  session({
    secret: "keyboard cat", // ដាក់ Key ងាប់ៗរបស់បងទៅ
    resave: false,
    saveUninitialized: true,
    cookie: {
      // កំណត់ទៅ ២៤ ម៉ោង
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// --- ៤. បម្រើឯកសារ Static & View Engine ---
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- ៥. កំណត់ Route (លំដាប់លំដោយគឺសំខាន់!) ---
app.use("/", authRoutes);
app.use("/user", userRoutes);
app.use("/", viewRoutes);
app.use("/history", historyRoutes);

// --- ៦. Socket Connection សម្រាប់ AI Tutor ---
io.on("connection", (socket) => {
  aiHandler(socket);
});

// --- ៧. បើកដំណើរការ Server និង Database ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Neural Engine is flying at http://localhost:${PORT}`);
});

connectDB();
