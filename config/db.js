const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("🍃 MongoDB Connected ជោគជ័យហើយបងប្រូ!");
    } catch (err) {
        console.error("❌ ចាប់ដៃគ្នាអត់ជាប់ទេបង៖", err.message);
    }
};

module.exports = connectDB;