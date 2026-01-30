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

  // ទុកសម្រាប់ដឹងថា User ចូលរៀនតាំងពីពេលណា
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model("User", UserSchema);