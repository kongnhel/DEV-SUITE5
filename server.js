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
const aiHandler = require("./controllers/aiController");
const User = require("./models/User");

// --- ១. កំណត់រចនាសម្ព័ន្ធ Firebase Admin (សំខាន់បំផុតដើម្បីបំបាត់ Error 401) ---
// បងត្រូវទាញយក file JSON ពី Firebase Console > Project Settings > Service Accounts
const serviceAccount = require("./config/firebase-service-key.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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

// --- ៤. បម្រើឯកសារ Static & View Engine ---
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- ៥. កំណត់ Route (លំដាប់លំដោយគឺសំខាន់!) ---
app.use("/", authRoutes);
app.use("/user", userRoutes);
app.use("/", viewRoutes);

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
