const ChatHistory = require("../models/ChatHistory");
const User = require("../models/User");
const admin = require('firebase-admin');

// --- ១. មុខងារ Update Profile ---
exports.updateProfile = async (req, res) => {
    const { displayName, photoURL } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'សូម Login សិនបងប្រូ!' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { displayName, photoURL },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ status: 'error', message: 'រកមិនឃើញ User ទេ!' });
        }

        return res.status(200).json({ 
            status: 'success', 
            message: 'Update Profile ជោគជ័យហើយ Idol!',
            user: updatedUser 
        });
    } catch (error) {
        console.error("Update Error:", error.message);
        return res.status(500).json({ status: 'error', message: 'Server គ្រេចកបាត់ហើយបង!' });
    }
};

// --- ២. មុខងារ getDashboard ---
exports.getDashboard = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.redirect("/login");

        const user = await User.findById(userId);
        
        if (!user) {
            req.session.destroy();
            return res.redirect("/login");
        }

        const totalWisdom = await ChatHistory.countDocuments({ userId: user._id });
        const tutorCount = await ChatHistory.countDocuments({ userId: user._id, toolName: "AI_TUTOR" });
        const recentActivity = await ChatHistory.find({ userId: user._id }).sort({ createdAt: -1 }).limit(3);
        
        res.render("dashboard", { 
            title: "Neural Dashboard",
            pageKey: "dashboard",
            user, 
            totalWisdom, 
            tutorCount, 
            recentActivity, 
            theme: "#a855f7" 
        });
    } catch (err) {
        res.status(500).send("Dashboard Sync Error: " + err.message);
    }
}; // <--- ត្រូវបិទវង់ក្រចកត្រង់នេះឱ្យដាច់ដោយឡែក!

// --- ៣. មុខងារ deleteAccount (ឥឡូវវាមានឯករាជ្យហើយ!) ---
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'រកមិនឃើញ User ទេបងប្រូ!' });
        }

        // លុបចេញពី Firebase Auth
        if (user.firebaseUid) {
            await admin.auth().deleteUser(user.firebaseUid);
        }

        // លុប History និង User ចេញពី MongoDB
        await ChatHistory.deleteMany({ userId: userId });
        await User.findByIdAndDelete(userId);

        // បំផ្លាញ Session ចោល
        req.session.destroy();

        res.status(200).json({ status: 'success', message: 'គណនីត្រូវបានកម្ទេចចោលហើយ!' });

    } catch (error) {
        console.error("Delete Error:", error.message);
        res.status(500).json({ status: 'error', message: 'ការលុបមានបញ្ហា៖ ' + error.message });
    }
};