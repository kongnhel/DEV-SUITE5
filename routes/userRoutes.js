const express = require("express");
const router = express.Router();
const multer = require("multer");
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/auth"); // Middleware ដែលយើងធ្លាប់ធ្វើ

const upload = multer({ storage: multer.memoryStorage() });

router.get("/profile", authMiddleware, (req, res) => {
  res.render("profile", {
    title: "Neural Profile",
    pageKey: "profile",
    user: res.locals.user,
    theme: "#a855f7",
  });
});
// ប្រើ Middleware ការពារដើម្បីឱ្យប្រាកដថា ទាល់តែ Login ទើបចូលដល់ Controller
// router.post('/update-profile', authMiddleware, userController.updateProfile);
router.post(
  "/update-profile",
  upload.single("photo"),
  userController.updateProfile,
);

router.post("/delete-account", authMiddleware, userController.deleteAccount);

module.exports = router;
