const { GoogleGenerativeAI } = require("@google/generative-ai"); // មើលឈ្មោះឱ្យច្បាស់!
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

module.exports = model;
