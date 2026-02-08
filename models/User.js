const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  // លេខសម្គាល់យកចេញពី Firebase (UID)
  firebaseUid: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },

  displayName: { 
    type: String, 
    default: "Neural Learner" 
  },

  // សម្រាប់ដាក់រូប Profile បែប Anime ឬតួអង្គ MLBB
  photoURL: { 
    type: String, 
    default: "https://api.dicebear.com/7.x/adventurer/svg?seed=Lucky" 
  },

  // កំណត់សិទ្ធិ (សម្រាប់គម្រោង Class Management)
  role: { 
    type: String, 
    enum: ["student", "teacher", "admin"], 
    default: "student" 
  },

  // --- 🚀 គ្រឿងផ្សំថ្មីសម្រាប់ប្រព័ន្ធ Subscription ---
  
  // ១. កំណត់ប្រភេទគម្រោងរបស់ User
  plan: { 
    type: String, 
    enum: ["standard", "pro", "elite"], 
    default: "standard" 
  },

  // ២. ចំនួនសំណួរដែល User បានប្រើ (សម្រាប់ Rate Limiting)
  requestCount: { 
    type: Number, 
    default: 0 
  },

  // ៣. កាលបរិច្ឆេទសំណួរចុងក្រោយ (ទុកសម្រាប់ Reset រាល់ថ្ងៃ)
  lastRequestDate: { 
    type: Date, 
    default: Date.now 
  },

  // ទុកសម្រាប់ដឹងថា User ចូលរៀនតាំងពីពេលណា
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
  
});

module.exports = mongoose.model("User", UserSchema);