const ChatHistory = require("../models/ChatHistory");
const aiModel = require("../config/gemini");

/**
 * មុខងារជំនួយសម្រាប់សម្អាត និង Parse JSON ចេញពី AI Response
 */
const parseAIJson = (text) => {
  try {
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("❌ JSON Parse Error:", e.message);
    return { error: "AI ឆ្លើយមកមិនមែនជា JSON ត្រឹមត្រូវទេ!", raw: text };
  }
};

module.exports = (socket) => {
  console.log("✅ User connected: " + socket.id);

  // --- ១. មុខងារ AI CODE REVIEWER & FIXER ---
  socket.on("review_code", async (data) => {
    const { code, userComment } = data;
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
      const response = await result.response;
      const aiData = parseAIJson(response.text());

      // --- បញ្ចូលក្នុង DB ---
      await ChatHistory.create({
        toolName: "CODE_REVIEWER",
        userInput: `Comment: ${userComment} | Code: ${code}`,
        aiResponse: aiData,
        userId: socket.request.session.userId
      });

      socket.emit("review_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "Senior Dev វិលមុខបន្តិចហើយ: " + e.message);
    }
  });

  // --- ២. មុខងារ AI KHMER CULTURE GUIDE ---
  socket.on("ask_culture", async (data) => {
    const { question, type } = data;
    try {
      const lengthInstruction =
        type === "detailed"
          ? "Provide a comprehensive, deep-dive explanation with historical context and specific details."
          : "Make it very short, punchy, and highlight only the most important facts.";

      const prompt = `
                You are a Khmer Culture Expert specializing in Angkor Wat and traditional arts.
                Task: Answer this question: "${question}"
                FORMAT INSTRUCTION: ${lengthInstruction}
                LANGUAGE: Funny and witty Khmer.
                GUARDRAIL: If the question is NOT about Khmer culture, politely refuse in a funny way.`;

      const result = await aiModel.generateContent(prompt);
      const response = await result.response;
      const aiResponseText = response.text();

      // --- បញ្ចូលក្នុង DB ---
      await ChatHistory.create({
        toolName: "KHMER_CULTURE",
        userInput: question,
        aiResponse: { response: aiResponseText },
        userId: socket.request.session.userId
      });

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
    try {
      const prompt = `Convert this code into Mermaid.js flowchart syntax. 
                ONLY return the mermaid syntax starting with "graph TD". No markdown blocks.
                Code: "${data.code}"`;

      const result = await aiModel.generateContent(prompt);
      const response = await result.response;
      const mermaidCode = response.text().trim();

      // --- បញ្ចូលក្នុង DB ---
      await ChatHistory.create({
        toolName: "LOGIC_VISUALIZER",
        userInput: data.code,
        aiResponse: { mermaidCode },
        userId: socket.request.session.userId
      });

      socket.emit("visualize_result", { mermaidCode });
    } catch (e) {
      socket.emit("error_occured", "គូររូបមិនចេញទេ: " + e.message);
    }
  });

  // --- ៤. មុខងារ AI STUDY ASSISTANT ---
  socket.on("study_assist", async (data) => {
    const { content } = data;
    try {
      const prompt = `
                You are a brilliant and helpful Khmer Study Companion. 
                Analyze this educational content: "${content}"
                Task:
                1. Provide a concise SUMMARY of the content in Khmer.
                2. Extract 3 KEY CONCEPTS.
                3. Generate 3 Multiple Choice Questions (MCQ).
                Return ONLY raw JSON:
                {
                  "summary": "...",
                  "key_concepts": ["...", "...", "..."],
                  "quiz": [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}],
                  "funny_motivation": "..."
                }`;

      const result = await aiModel.generateContent(prompt);
      const response = await result.response;
      const aiData = parseAIJson(response.text());

      // --- បញ្ចូលក្នុង DB ---
      await ChatHistory.create({
        toolName: "STUDY_ASSISTANT",
        userInput: content,
        aiResponse: aiData,
        userId: socket.request.session.userId
      });

      socket.emit("study_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "AI រៀនមិនទាន់ចេះទេ: " + e.message);
    }
  });

  // --- ៥. មុខងារ AI K-IDA (Document Chat) ---
  socket.on("ask_kida", async (data) => {
    const { userQuery, pages } = data;
    try {
      const context = pages
        .map((p) => `[PAGE_${p.page}]: ${p.text}`)
        .join("\n\n");
      const prompt = `
                You are K-IDA. Use the following context to answer.
                CONTEXT: ${context}
                QUESTION: "${userQuery}"
                STRICT OUTPUT RULES:
                - ALWAYS answer in Khmer.
                - Return ONLY a raw JSON object:
                {"answer": "...", "page_found": "..."}`;

      const result = await aiModel.generateContent(prompt);
      const response = await result.response;
      const aiData = parseAIJson(response.text());

      // --- បញ្ចូលក្នុង DB ---
      await ChatHistory.create({
        toolName: "K_IDA",
        userInput: userQuery,
        aiResponse: aiData,
        userId: socket.request.session.userId
      });

      socket.emit("kida_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "K-IDA រកឯកសារមិនឃើញ: " + e.message);
    }
  });

  // --- ៦. មុខងារ AI TUTOR ---
  socket.on("ask_tutor", async (data) => {
    const { topic, mode } = data;
    try {
      const styleInstruction =
        mode === "kid"
          ? "Explain like I'm 5 years old using very funny metaphors."
          : "Explain simply for beginners with clear logic.";

      const prompt = `
                You are a professional Khmer Teacher. 
                Topic: "${topic}"
                Style: ${styleInstruction}

                STRICT RULE: Return ONLY a raw JSON object with this structure:
                {
                  "title": "ចំណងជើងមេរៀន",
                  "explanation": "ការពន្យល់ខ្លីខ្លឹមជាភាសាខ្មែរ",
                  "key_points": [
                    {"label": "ពាក្យបច្ចេកទេស", "desc": "ការពន្យល់ពាក្យនោះ"},
                    ...
                  ],
                  "examples": ["ឧទាហរណ៍ទី១", "ឧទាហរណ៍ទី២"],
                  "fun_fact": "រឿងកំប្លែងខ្លីៗពាក់ព័ន្ធនឹងប្រធានបទ"
                }
            `;

      const result = await aiModel.generateContent(prompt);
      const response = await result.response;
      const cleanJson = response
        .text()
        .replace(/```json|```/g, "")
        .trim();
      const aiData = JSON.parse(cleanJson);

      // --- បញ្ចូលក្នុង DB ---
      await ChatHistory.create({
        toolName: "AI_TUTOR",
        userInput: topic,
        aiResponse: aiData,
        userId: socket.request.session.userId
      });

      socket.emit("tutor_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "គ្រូ AI គ្រេចកបាត់ហើយ៖ " + e.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected: " + socket.id);
  });
};
