const admin = require("firebase-admin");
const User = require("../models/User"); // ត្រូវប្រាកដថាបងមាន File នេះក្នុង models
const sendWelcomeEmail = require("../utils/emailSender");

exports.sessionLogin = async (req, res) => {
    const { idToken, isRegistering } = req.body;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name, picture } = decodedToken;

        let user = await User.findOne({ email: email });

        if (!user && isRegistering) {
            // បង្កើត User ថ្មីក្នុង MongoDB
            user = await User.create({
                firebaseUid: uid,
                email: email,
                displayName: name || "Neural Learner",
                photoURL: picture || "",
            });

            // ២. ហៅផ្ញើ Email ស្វាគមន៍ (ដក 'await' ចេញ ដើម្បីឱ្យវាដើរលឿនស្លេវ)
            sendWelcomeEmail(user.email, user.displayName); 
        }

        // បន្តបង្កើត Session...
        req.session.userId = user._id;
        res.status(200).json({ status: 'success' });

    } catch (error) {
        res.status(401).json({ status: "error", message: error.message });
    }
};

/**
 * Handle Logout
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Logout Error");
    res.clearCookie("connect.sid"); // លុបសោរចេញពី Browser
    res.redirect("/login");
  });
};
