
const ChatHistory = require("../models/ChatHistory");
const path = require("path");
const User = require("../models/User");

exports.getIndex = async (req, res) => {
            const user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";

    if (user && user.plan === 'standard') { 
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

        // ឆែកមើល Quota ៥ ដង
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីគូរប្លង់មិនកំណត់! 🏗️";
        }
    }

    res.render("index", { title: "AI Reviewer", pageKey: "reviewer", theme: "#00f2ff", isLimitReached, limitMessage }); // ពណ៌ Cyan
};

exports.getCulture = async (req, res) => {

    const  user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";
    if (user && user.plan === 'standard') {
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីចូលរួមវប្បធម៌ខ្មែរមិនកំណត់! 🇰🇭";
        }
        }
    res.render("culture", { title: "Khmer Culture", pageKey: "culture", theme: "#ffd700", isLimitReached, limitMessage }); // ពណ៌មាស

};

exports.getPlanner = async (req, res) => {
        const user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";

    if (user && user.plan === 'standard') { 
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

        // ឆែកមើល Quota ៥ ដង
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីគូរប្លង់មិនកំណត់! 🏗️";
        }
    }
    res.render("architect", { 
        title: "Architect AI", 
        pageKey: "architect", 
        theme: "#f97316",
        isLimitReached,
        limitMessage
    }); // ពណ៌ទឹកក្រូច
};

exports.getVisualizer = async (req, res) => {
            const user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";

    if (user && user.plan === 'standard') { 
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

        // ឆែកមើល Quota ៥ ដង
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីគូរប្លង់មិនកំណត់! 🏗️";
        }
    }
    res.render("visualizer", { title: "Logic Visualizer", pageKey: "visualizer", theme: "#a855f7", isLimitReached, limitMessage }); // ពណ៌ស្វាយ
};

exports.getStudyBuddy = async (req, res) => {
    const user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";

    if (user && user.plan === 'standard') {
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

        // ឆែកមើល Quota ៥ ដង
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីគូរប្លង់មិនកំណត់! 🏗️";
        }
    }
    res.render("study-buddy", { title: "Study Buddy", pageKey: "study", theme: "#22c55e", isLimitReached, limitMessage }); // ពណ៌បៃតង
};

exports.getKida = async (req, res) => {
    const user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";

    if (user && user.plan === 'standard') { 
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

        // ឆែកមើល Quota ៥ ដង
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីគូរប្លង់មិនកំណត់! 🏗️";
        }
    }
    res.render("kida", { title: "K-IDA AI", pageKey: "kida", theme: "#ef4444", isLimitReached, limitMessage }); // ពណ៌ក្រហម
};

exports.getTutor = async (req, res) => {
    const user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";

    if (user && user.plan === 'standard') {
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

        // ឆែកមើល Quota ៥ ដង
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីគូរប្លង់មិនកំណត់! 🏗️";
        }
    }
    res.render("tutor", { title: "AI Tutor", pageKey: "tutor", theme: "#38bdf8", isLimitReached, limitMessage }); // ពណ៌ Cyan ភ្លឺ
};

exports.getLoveGuru = async (req, res) => {
    const user = await User.findById(req.session.userId);
    let isLimitReached = false;
    let limitMessage = "";

    if (user && user.plan === 'standard') { 
        const today = new Date().setHours(0, 0, 0, 0);
        const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

        // ឆែកមើល Quota ៥ ដង
        if (today === lastReqDate && user.requestCount >= 5) {
            isLimitReached = true;
            limitMessage = "បងប្រើដល់ដែនកំណត់ ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! Upgrade ទៅ Pro ដើម្បីគូរប្លង់មិនកំណត់! 🏗️";
        }
    }
    res.render("love-guru", { title: "Love Guru", pageKey: "love", theme: "#f472b6", isLimitReached, limitMessage }); // ពណ៌ផ្កាឈូក
};
exports.getPlan = (req, res) => {
    res.render("plans", { title: "Plan Generator", pageKey: "plan", theme: "#34d399" }); // ពណ៌បៃតងភ្លឺ
};


exports.getHistory = async (req, res) => {
    try {
        const { search, tool } = req.query;
        
        // ១. បន្ថែមរបាំងការពារ៖ ទាញយក ID របស់ User ដែលកំពុង Login
        const userId = req.session.userId;

        // ២. កំណត់ឱ្យ Query រកតែ History ណាដែលជារបស់ម្ចាស់ ID នេះប៉ុណ្ណោះ
        let query = { userId: userId }; 

        // ៣. បន្ថែម Logic ស្វែងរកតាមពាក្យគន្លឹះ (Search)
        if (search) {
            query.userInput = { $regex: search, $options: "i" };
        }

        // ៤. បន្ថែម Logic ច្រោះតាមប្រភេទ Tool (Filter)
        if (tool && tool !== "ALL") {
            query.toolName = tool;
        }

        const history = await ChatHistory.find(query).sort({ createdAt: -1 });
        
        res.render("history", { 
            title: "Neural Archive", 
            pageKey: "history", 
            theme: "#a855f7",
            history: history,
            currentSearch: search || "",
            currentTool: tool || "ALL",
            user: res.locals.user // បោះទិន្នន័យ User ទៅបង្ហាញរូប Profile
        });
    } catch (err) {
        res.status(500).send("Archive Error: " + err.message);
    }
};

// exports.getIndex = async (req, res) => {
//     const userId = req.session.userId;
//     const user = await User.findById(userId);
    
//     let isLimitReached = false;
//     let limitMessage = "";

//     if (user && user.plan === 'standard') {
//         const today = new Date().setHours(0, 0, 0, 0);
//         const lastReqDate = new Date(user.lastRequestDate).setHours(0, 0, 0, 0);

//         // បើនៅថ្ងៃដដែល ហើយសួរអស់ ៥ ដងហើយ
//         if (today === lastReqDate && user.requestCount >= 5) {
//             isLimitReached = true;
//             limitMessage = "បងប្រើអស់ Quota ៥ ដងសម្រាប់ថ្ងៃនេះហើយ! ចាំស្អែក ឬ Upgrade ឥឡូវហ្មងទៅមេ! 😂";
//         }
//     }

//     res.render("index", { 
//         title: "AI Reviewer", 
//         pageKey: "reviewer", 
//         theme: "#00f2ff",
//         isLimitReached, // បោះតម្លៃនេះទៅ Frontend
//         limitMessage
//     });
// };