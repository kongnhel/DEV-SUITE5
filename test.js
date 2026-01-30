require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

(async () => {
  try {
    console.log("🔍 កំពុងប្រើ Gemini 2.5 Flash មកឆ្លើយ...");
    
    const res = await client.models.generateContent({
      model: "gemini-2.5-flash", // ប្រើឈ្មោះដែលប្អូនទើបតែរកឃើញ
      contents: [{ role: "user", parts: [{ text: "សួស្តី! តើអ្នកជាជំនាន់ទីប៉ុន្មាន?" }] }]
    });

    console.log("✅ ចម្លើយ AI:", res.text || res.response.text());

  } catch (error) {
    console.error("🚨 Error:", error.message);
  }
})();