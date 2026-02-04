const ChatHistory = require("../models/ChatHistory");
const textToSpeech = require("@google-cloud/text-to-speech");
const ttsClient = new textToSpeech.TextToSpeechClient();
const aiModel = require("../config/gemini");
const User = require("../models/User");

// --- ១. ប្រព័ន្ធការពារការ Spam (Rate Limiter) ---
const userRateLimits = new Map();
const RATE_LIMIT_MS = 5000; // ម្នាក់អាចសួរបានតែ ១ ដង ក្នុង ៥ វិនាទី

const isRateLimited = (socketId) => {
  const now = Date.now();
  if (userRateLimits.has(socketId)) {
    const lastTime = userRateLimits.get(socketId);
    if (now - lastTime < RATE_LIMIT_MS) return true;
  }
  userRateLimits.set(socketId, now);
  return false;
};

/**
 * មុខងារជំនួយសម្រាប់សម្អាត និង Parse JSON ចេញពី AI Response
 */
const parseAIJson = (text) => {
  try {
    // ១. ស្វែងរក JSON string ដែលចាប់ផ្ដើមដោយ { និងបញ្ចប់ដោយ }
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("រកមិនឃើញ JSON object ក្នុង Response ទេ!");
    }

    const cleanJson = jsonMatch[0].trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("❌ JSON Parse Error:", e.message);

    // បើ Parse អត់ចេញទេ កុំឱ្យ App ងាប់ ឱ្យវាចេញ Response បែបឌឺដងជំនួស
    return {
      sentiment: "confused",
      humorous_response:
        "អូយ! បងសរសេរកូដអីហ្នឹង? AI មើលហើយចង់គាំងក្បាលវិលបោះ JSON មកអត់កើតហ្មង! 😂",
      technical_review:
        "Error: AI response formatting issues. Raw data: " +
        text.substring(0, 100) +
        "...",
      fixed_code: text,
    };
  }
};

module.exports = (socket) => {
  console.log("✅ Neural Link Established: " + socket.id);

  // 🛡️ មុខងាររក User ក្នុង DB ដោយប្រើ Firebase UID
  const findUserByUid = async (firebaseUid) => {
    if (!firebaseUid) return null;
    return await User.findOne({ firebaseUid });
  };

  // --- ១. AI CODE REVIEWER & FIXER ---
  socket.on("review_code", async (data) => {
    if (isRateLimited(socket.id))
      return socket.emit(
        "error_occured",
        "ចិត្តត្រជាក់ៗប្អូន! កុំចុចញាប់ពេក បង AI វិលមុខ...",
      );

    const { code, userComment, firebaseUid } = data;
    try {
      const user = await findUserByUid(firebaseUid);
      let historyContext = "";

      if (user) {
        const previousChats = await ChatHistory.find({
          userId: user._id,
          toolName: "CODE_REVIEWER",
        })
          .sort({ createdAt: -1 })
          .limit(3); // យកតែ ៣ ចុងក្រោយបានហើយ កុំឱ្យ Prompt វែងពេក

        if (previousChats.length > 0) {
          historyContext =
            "PREVIOUS CONVERSATION LOGS:\n" +
            previousChats
              .reverse()
              .map(
                (chat) =>
                  `- User Asked: ${chat.userInput}\n- AI Roasted: ${chat.aiResponse.humorous_response}`,
              )
              .join("\n");
        }
      }
      const prompt = `You are a funny expert Khmer Senior Developer and if code has more error please text joke "បែកចឹង ស្រលាញ់គេម្នាក់ឯងមែន?😂"as Khmer language.
                TASK: Analyze code/comment.
                STRICT RULES:
                1. Answer EVERYTHING in Khmer language only.
                2. Return ONLY JSON.
                3. ប្រសិនបើកូដនោះមាន Bug ធ្ងន់ធ្ងរ ត្រូវឌឺដងឱ្យខ្លាំង (Roasted).
                4. ប្រសិនបើកូដនោះសរសេរបានល្អពេក ត្រូវសម្តែងការច្រណែនបែបកំប្លែង.
                5. ប្រើពាក្យស្លោកក្នុងស្រុក (Slang) របស់ក្មេងស្ទាវ Dev ខ្មែរឆ្នាំ 2026។.
                FEW-SHOT EXAMPLE:
                Input: code: "print('hi')", comment: "អត់ដើរទេបង"
                Response: {
                    "sentiment": "confused",
                    "humorous_response": "ចុះប្អូនឯងចង់ឱ្យវាហោះទៅណា បើអត់ទាន់មាន Variable ផងហ្នឹង? 😂",
                    "technical_review": "Code នេះដើរធម្មតា តែប្អូនប្រហែលភ្លេច Run ក្នុង Terminal ហើយ។",
                    "fixed_code": "print('Hello World!')"
                }
                Current Input: Comment: "${userComment}" | Code: "${code}"`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      if (user) {
        await ChatHistory.create({
          toolName: "CODE_REVIEWER",
          userInput: `Comment: ${userComment} | Code: ${code.substring(0, 100)}`,
          aiResponse: aiData,
          userId: user._id,
        });
      }

      // ៧. បោះលទ្ធផលទៅឱ្យ Client (EJS)
      socket.emit("review_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "Senior Dev វិលមុខហើយ: " + e.message);
    }
  });

  // --- ២. AI KHMER CULTURE GUIDE ---
  socket.on("ask_culture", async (data) => {
    if (isRateLimited(socket.id)) return;
    const { question, type, firebaseUid } = data;
    try {
      const lengthHint =
        type === "detailed"
          ? "ពន្យល់ឱ្យលម្អិត និងស៊ីជម្រៅ"
          : "សង្ខេបខ្លីៗ តែខ្លឹម";
      const prompt = `You are a Khmer Culture Expert. 
                STRICT RULES:
                1. Language: Funny and witty Khmer ONLY.
                2. If the question is NOT about Khmer culture/history, refuse in a funny Khmer way.
                3. Format: ${lengthHint}.
                Question: "${question}"`;

      const result = await aiModel.generateContent(prompt);
      const aiResponseText = result.response.text();

      const user = await findUserByUid(firebaseUid);
      if (user) {
        await ChatHistory.create({
          toolName: "KHMER_CULTURE",
          userInput: question,
          aiResponse: { response: aiResponseText },
          userId: user._id,
        });
      }
      socket.emit("culture_result", { response: aiResponseText });
    } catch (e) {
      socket.emit("error_occured", "មគ្គុទ្ទេសក៍សន្លប់បាត់: " + e.message);
    }
  });

  // --- ៣. AI LOGIC VISUALIZER ---
  socket.on("visualize_logic", async (data) => {
    if (isRateLimited(socket.id)) return;
    const { code, firebaseUid } = data;
    try {
      const prompt = `Convert this code into Mermaid.js flowchart syntax (graph TD).
                STRICT RULES:
                1. Use Khmer language for all labels inside the flowchart nodes.
                2. Output ONLY the mermaid syntax.
                Code: "${code}"`;

      const result = await aiModel.generateContent(prompt);
      const mermaidCode = result.response
        .text()
        .trim()
        .replace(/```mermaid|```/gi, "");

      const user = await findUserByUid(firebaseUid);
      if (user) {
        await ChatHistory.create({
          toolName: "LOGIC_VISUALIZER",
          userInput: code,
          aiResponse: { mermaidCode },
          userId: user._id,
        });
      }
      socket.emit("visualize_result", { mermaidCode });
    } catch (e) {
      socket.emit("error_occured", "គូររូបមិនចេញទេ: " + e.message);
    }
  });

  // --- ៤. AI STUDY ASSISTANT ---
  socket.on("study_assist", async (data) => {
    if (isRateLimited(socket.id)) return;
    const { content, firebaseUid } = data;
    try {
      const prompt = `You are a helpful Khmer Study Buddy.
                STRICT RULES:
                1. Answer EVERYTHING in Khmer language ONLY.
                2. Return ONLY JSON:
                {
                  "summary": "សង្ខេបមេរៀនឱ្យងាយយល់",
                  "key_concepts": ["ចំណុចទី១", "ចំណុចទី២", "ចំណុចទី៣"],
                  "quiz": [{"question": "សំណួរតេស្តសមត្ថភាព", "options": ["ក", "ខ", "គ", "ឃ"], "answer": "ក"}],
                  "funny_motivation": "ពាក្យលើកទឹកចិត្តបែបកំប្លែង"
                }
                Analyze: "${content}"`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      const user = await findUserByUid(firebaseUid);
      if (user) {
        await ChatHistory.create({
          toolName: "STUDY_ASSISTANT",
          userInput: content.substring(0, 100) + "...",
          aiResponse: aiData,
          userId: user._id,
        });
      }
      socket.emit("study_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "AI រៀនមិនទាន់ចេះទេ: " + e.message);
    }
  });

  // --- ៥. AI K-IDA (Document Chat) ---
  socket.on("ask_kida", async (data) => {
    if (isRateLimited(socket.id)) return;
    const { userQuery, pages, firebaseUid } = data;
    try {
      const context = pages
        .map((p) => `[PAGE_${p.page}]: ${p.text}`)
        .join("\n\n");
      const prompt = `You are K-IDA, a smart Document Assistant.
                Context: ${context}
                STRICT RULES:
                1. Answer the QUESTION in Khmer language only based on the context.
                2. Return ONLY JSON: {"answer": "ចម្លើយយ៉ាងលម្អិត", "page_found": "លេខទំព័រ"}
                Question: "${userQuery}"`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      const user = await findUserByUid(firebaseUid);
      if (user) {
        await ChatHistory.create({
          toolName: "K_IDA",
          userInput: userQuery,
          aiResponse: aiData,
          userId: user._id,
        });
      }
      socket.emit("kida_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "K-IDA រកមិនឃើញ: " + e.message);
    }
  });

  // --- ៦. AI TUTOR ---
  socket.on("ask_tutor", async (data) => {
    if (isRateLimited(socket.id)) return;
    const { topic, mode, firebaseUid } = data;
    try {
      const user = await findUserByUid(firebaseUid);
      if (!user) return socket.emit("error_occured", "សូម Login សិនម៉ូយ!");

      const style =
        mode === "kid"
          ? "ពន្យល់ដូចក្មេងអាយុ ៥ ឆ្នាំ (ភាសាសាមញ្ញបំផុត)"
          : "ពន្យល់បែបអាជីព និងងាយយល់";
      const prompt = `You are an expert Khmer Teacher. 
        STRICT RULES:
        1. Answer EVERYTHING in Khmer.
        2. Topic: "${topic}" | Style: ${style}
        3. Return ONLY valid JSON with this structure:
        {
          "title": "ចំណងជើងមេរៀន",
          "explanation": "ការបកស្រាយសង្ខេប",
          "key_points": [
            {"label": "ចំណុចសំខាន់ទី១", "desc": "ការពិពណ៌នាទី១"},
            {"label": "ចំណុចសំខាន់ទី២", "desc": "ការពិពណ៌នាទី២"}
          ],
          "examples": ["ឧទាហរណ៍១", "ឧទាហរណ៍២"],
          "fun_fact": "រឿងគួរឱ្យចាប់អារម្មណ៍"
        }`;

      const result = await aiModel.generateContent(prompt);
      const aiData = parseAIJson(result.response.text());

      await ChatHistory.create({
        toolName: "AI_TUTOR",
        userInput: topic,
        aiResponse: aiData,
        userId: user._id,
      });
      socket.emit("tutor_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "បញ្ហាបច្ចេកទេស: " + e.message);
    }
  });

  socket.on("disconnect", () => {
    userRateLimits.delete(socket.id); // សម្អាត memory ពេល user ចាកចេញ
    console.log("❌ Neural Connection Lost: " + socket.id);
  });
};
