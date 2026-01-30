
const ChatHistory = require("../models/ChatHistory");
const path = require("path");

exports.getIndex = (req, res) => {
    res.render("index", { title: "AI Reviewer", pageKey: "reviewer", theme: "#00f2ff" }); // ពណ៌ Cyan
};

exports.getCulture = (req, res) => {
    res.render("culture", { title: "Khmer Culture", pageKey: "culture", theme: "#ffd700" }); // ពណ៌មាស
};

exports.getVisualizer = (req, res) => {
    res.render("visualizer", { title: "Logic Visualizer", pageKey: "visualizer", theme: "#a855f7" }); // ពណ៌ស្វាយ
};

exports.getStudyBuddy = (req, res) => {
    res.render("study-buddy", { title: "Study Buddy", pageKey: "study", theme: "#22c55e" }); // ពណ៌បៃតង
};

exports.getKida = (req, res) => {
    res.render("kida", { title: "K-IDA AI", pageKey: "kida", theme: "#ef4444" }); // ពណ៌ក្រហម
};

exports.getTutor = (req, res) => {
    res.render("tutor", { title: "AI Tutor", pageKey: "tutor", theme: "#38bdf8" }); // ពណ៌ Cyan ភ្លឺ
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