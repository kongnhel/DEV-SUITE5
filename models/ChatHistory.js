const mongoose = require("mongoose");

const ChatHistorySchema = new mongoose.Schema({
    // ១. នេះគឺជា "ខ្សែចម្លងវិញ្ញាណ" ភ្ជាប់ទៅកាន់ User
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }, 
    toolName: { 
        type: String, 
        required: true 
    }, // Reviewer, Tutor, K-IDA...
    userInput: { 
        type: String, 
        required: true 
    },
    aiResponse: { 
        type: Object, 
        required: true 
    }, // រក្សាទុក JSON ទាំងមូលពី AI
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model("ChatHistory", ChatHistorySchema);