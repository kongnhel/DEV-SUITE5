const express = require("express");
const router = express.Router();
const viewController = require("../controllers/viewController");
const userController = require("../controllers/userController");
const admin = require('firebase-admin');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');


router.get("/", authMiddleware,viewController.getIndex);
router.get("/culture", authMiddleware, viewController.getCulture);
router.get("/visualizer", authMiddleware, viewController.getVisualizer);
router.get("/study-buddy", authMiddleware, viewController.getStudyBuddy);
router.get("/kida", authMiddleware, viewController.getKida);
router.get("/tutor", authMiddleware, viewController.getTutor);
router.get("/history", authMiddleware, viewController.getHistory);
router.get('/dashboard', authMiddleware, userController.getDashboard);

router.get('/profile', authMiddleware, (req, res) => {
    res.render('profile', { title: 'Neural Profile', user: res.locals.user });
});

exports.sessionLogin = async (req, res) => {
    const { idToken } = req.body; // Destructuring ឱ្យមើលទៅឡូយបន្តិច
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name, picture } = decodedToken; // ទាញយកព័ត៌មានបន្ថែម

        // ស្វែងរក ឬ បង្កើត User ថ្មី
        let user = await User.findOne({ firebaseUid: uid });
        if (!user) {
            user = await User.create({ 
                firebaseUid: uid, 
                email: email,
                displayName: name || "Neural Learner", // ថែមឈ្មោះឱ្យវាស្គាល់គ្នា
                photoURL: picture || "" // ថែមរូបឱ្យមើលទៅសង្ហា
            });
        }

        // ចងភ្ជាប់មន្តអាគម Session
        req.session.userId = user._id;
        
        return res.status(200).json({ status: 'success', message: 'ចូលបន្ទប់រៀនជោគជ័យ!' });
    } catch (error) {
        console.error("Auth Error:", error.message);
        return res.status(401).json({ status: 'error', message: 'សំបុត្រចូលក្លែងក្លាយបងប្រូ!' });
    }
};

module.exports = router;