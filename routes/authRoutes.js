const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// ១. បើកទ្វារឱ្យ User ចូលទៅមើលទំព័រ Login
// បន្ថែម Route នេះដើម្បីឱ្យ Server បោះទំព័រ login.ejs ទៅឱ្យ Browser
router.get('/login', (req, res) => {
    res.render('login', { 
        title: 'Neural Access', 
        pageKey: 'login', 
        theme: '#22d3ee',
        firebaseConfig: {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID
        }
    });
});

// កុំភ្លេចថែមទំព័រ register ផងដែរ
router.get("/register", (req, res) => {
  res.render("register", {
    title: "Neural Register",
    pageKey: "register",
    theme: "#a855f7",
    firebaseConfig: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
    },
  });
});
// ២. Route សម្រាប់ Handle Firebase Session (ដែលបងធ្វើមុនហ្នឹង)
router.post("/api/auth/session", authController.sessionLogin);

router.get('/logout', authController.logout);

module.exports = router;
