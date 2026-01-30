const ChatHistory = require("../models/ChatHistory");
const aiModel = require("../config/gemini");


/**
 * មុខងារជំនួយសម្រាប់សម្អាត និង Parse JSON ចេញពី AI Response
 */
const parseAIJson = (text) => {
  try {
    // សម្អាត Markdown blocks ឱ្យកាន់តែហ្មត់ចត់
    const cleanJson = text.replace(/```json|```|`|json/gi, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("❌ JSON Parse Error:", e.message);
    return { error: "AI ឆ្លើយមកមិនមែនជា JSON ត្រឹមត្រូវទេ!", raw: text };
  }
};

module.exports = (socket) => {
  console.log("✅ Neural Link Established: " + socket.id);

  // 🛡️ Middleware តូចមួយក្នុង Socket ដើម្បីឆែក userId
  const getUserId = () => {
    const userId = socket.request.session
      ? socket.request.session.userId
      : null;
    if (!userId) {
      console.warn(
        "⚠️ Warning: Session userId is missing for socket: " + socket.id,
      );
    }
    return userId;
  };

  // --- ១. មុខងារ AI CODE REVIEWER & FIXER ---
  socket.on("review_code", async (data) => {
    const { code, userComment } = data;
    const userId = getUserId(); //

    try {
      const prompt = `
        You are a funny and expert Khmer Senior Developer.
        Task: Analyze the code and user comment.
        STRICT SENTIMENT RULES:
        - If user uses "😭", "💔", "😡", or "អាប្រកាច់" -> sentiment is "angry" or "sad".
        - If user is joking -> sentiment is "happy".
        - Respond ONLY with raw JSON:
        {
          "sentiment": "happy/angry/sad/confused",
          "humorous_response": "ចម្លើយលេងសើចបែបឌឺដង ឬលួងលោមជាភាសាខ្មែរ",
          "technical_review": "ការវិភាគបច្ចេកទេស",
          "fixed_code": "..."
        }
        User says: "${userComment}" | Code: "${code}"`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      // រក្សាទុកក្នុង DB លុះត្រាតែមាន userId
      if (userId) {
        await ChatHistory.create({
          toolName: "CODE_REVIEWER",
          userInput: `Comment: ${userComment}`,
          aiResponse: aiData,
          userId: userId,
        });
      }

      socket.emit("review_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "Senior Dev វិលមុខបន្តិចហើយ: " + e.message);
    }
  });

  // --- ២. មុខងារ AI KHMER CULTURE GUIDE ---
  socket.on("ask_culture", async (data) => {
    const { question, type } = data;
    const userId = getUserId();

    try {
      const lengthInstruction =
        type === "detailed"
          ? "Provide a comprehensive, deep-dive explanation."
          : "Make it short and punchy.";

      const prompt = `
        You are a Khmer Culture Expert. 
        Answer: "${question}"
        FORMAT: ${lengthInstruction}
        LANGUAGE: Funny and witty Khmer.
        GUARDRAIL: If not about Khmer culture, refuse in a funny way.`;

      const result = await aiModel.generateContent(prompt);
      const aiResponseText = result.response.text();

      if (userId) {
        await ChatHistory.create({
          toolName: "KHMER_CULTURE",
          userInput: question,
          aiResponse: { response: aiResponseText },
          userId: userId,
        });
      }

      socket.emit("culture_result", { response: aiResponseText });
    } catch (e) {
      socket.emit(
        "error_occured",
        "មគ្គុទ្ទេសក៍ទេសចរណ៍សន្លប់បាត់ហើយ: " + e.message,
      );
    }
  });

  // --- ៣. មុខងារ AI LOGIC VISUALIZER (Mermaid.js) ---
  socket.on("visualize_logic", async (data) => {
    const userId = getUserId();
    try {
      const prompt = `Convert this code into Mermaid.js flowchart syntax starting with "graph TD".
                      Code: "${data.code}"`;

      const result = await aiModel.generateContent(prompt);
      const mermaidCode = result.response
        .text()
        .trim()
        .replace(/```mermaid|```/gi, "");

      if (userId) {
        await ChatHistory.create({
          toolName: "LOGIC_VISUALIZER",
          userInput: data.code,
          aiResponse: { mermaidCode },
          userId: userId,
        });
      }

      socket.emit("visualize_result", { mermaidCode });
    } catch (e) {
      socket.emit("error_occured", "គូររូបមិនចេញទេ: " + e.message);
    }
  });

  // --- ៤. មុខងារ AI STUDY ASSISTANT ---
  socket.on("study_assist", async (data) => {
    const { content } = data;
    const userId = getUserId();
    try {
      const prompt = `You are a Khmer Study Companion. Analyze: "${content}"
                      Return ONLY JSON:
                      {
                        "summary": "...",
                        "key_concepts": ["...", "...", "..."],
                        "quiz": [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}],
                        "funny_motivation": "..."
                      }`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      if (userId) {
        await ChatHistory.create({
          toolName: "STUDY_ASSISTANT",
          userInput: content.substring(0, 100) + "...",
          aiResponse: aiData,
          userId: userId,
        });
      }

      socket.emit("study_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "AI រៀនមិនទាន់ចេះទេ: " + e.message);
    }
  });

  // --- ៥. មុខងារ AI K-IDA (Document Chat) ---
  socket.on("ask_kida", async (data) => {
    const { userQuery, pages } = data;
    const userId = getUserId();
    try {
      const context = pages
        .map((p) => `[PAGE_${p.page}]: ${p.text}`)
        .join("\n\n");
      const prompt = `You are K-IDA. Use CONTEXT: ${context} to answer QUESTION: "${userQuery}"
                      Return ONLY JSON: {"answer": "...", "page_found": "..."}`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      if (userId) {
        await ChatHistory.create({
          toolName: "K_IDA",
          userInput: userQuery,
          aiResponse: aiData,
          userId: userId,
        });
      }

      socket.emit("kida_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "K-IDA រកឯកសារមិនឃើញ: " + e.message);
    }
  });

  // --- ៦. មុខងារ AI TUTOR ---
  socket.on("ask_tutor", async (data) => {
    const { topic, mode } = data;
    const userId = getUserId();
    try {
      const styleInstruction =
        mode === "kid" ? "Explain like I'm 5." : "Explain simply.";
      const prompt = `You are a Khmer Teacher. Topic: "${topic}" Style: ${styleInstruction}
                      Return ONLY JSON: 
                      {
                        "title": "...", "explanation": "...", 
                        "key_points": [{"label": "...", "desc": "..."}], 
                        "examples": [], "fun_fact": "..."
                      }`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      if (userId) {
        await ChatHistory.create({
          toolName: "AI_TUTOR",
          userInput: topic,
          aiResponse: aiData,
          userId: userId,
        });
      }

      socket.emit("tutor_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "គ្រូ AI គ្រេចកបាត់ហើយ៖ " + e.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Neural Connection Lost: " + socket.id);
  });
};
