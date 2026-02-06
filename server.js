require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const admin = require("firebase-admin");
const MongoStore = require("connect-mongo");
const storeHandler = MongoStore.create ? MongoStore : (MongoStore.default || MongoStore);

const viewRoutes = require("./routes/viewRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const historyRoutes = require("./routes/history");
const aiHandler = require("./controllers/aiController");
const User = require("./models/User");

// --- ១. កំណត់រចនាសម្ព័ន្ធ Firebase Admin ---
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
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
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8, // ពង្រីកមាត់ច្រកដល់ 100MB សម្រាប់បូម PDF/Image
});

// --- ២. Middleware & Session Storage (ចំណុចស្លាប់រស់) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// បន្ថែម Header ការពារបញ្ហា Popup Login
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// Upgrade Session ឱ្យទៅជា Production Grade (សល់តែ ១ ជាន់គត់)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "neural_secret_key",
    resave: false,
    saveUninitialized: false,
    store: storeHandler.create({ 
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions'
    }),
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 
    },
  })
);
// --- ៣. Middleware ចម្លងទិន្នន័យ User ទៅកាន់ View ---
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

// --- ៥. កំណត់ Route ---
app.use("/", authRoutes);
app.use("/user", userRoutes);
app.use("/", viewRoutes);
app.use("/history", historyRoutes);

// --- ៦. Socket Connection ---
io.on("connection", (socket) => {
  aiHandler(socket);
});

// --- ៧. បើកដំណើរការ Server និង Database ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Neural Engine is flying at http://localhost:${PORT}`);
});

connectDB();
