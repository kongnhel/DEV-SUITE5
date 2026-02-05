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
// controller.js - AI KHMER CULTURE GUIDE
socket.on("ask_culture", async (data) => {
    const { question, image, type, firebaseUid } = data;
    try {
        const user = await findUserByUid(firebaseUid);
        socket.cultureHistory = socket.cultureHistory || [];
        const context = socket.cultureHistory.slice(-4).join("\n");

        const prompt = `
            You are 'Lork Ta Sage' (លោកតាឥសី), a wise, ancient, yet funny Khmer guardian of knowledge.
            Context of current conversation: ${context}

            STRICT RULES:
            1. Speak in a mix of ancient and modern Khmer slang. Use terms like 'ចៅឯង', 'ក្រាំងមាស', 'មន្តអាគម'.
            2. If an image is provided (temple, artifact, cloth), analyze it like a legendary archaeologist.
            3. If the question isn't about Khmer culture, refuse by saying you only protect Khmer heritage!
            4. Format: ${type === "detailed" ? "Deep wisdom" : "Short & sharp"}.
            5. Use Markdown for styling.
        `;

        let generativeContent = [prompt + "\nQuestion: " + question];
        if (image) {
            generativeContent.push({ inlineData: { data: image, mimeType: "image/jpeg" } });
        }

        const result = await aiModel.generateContent(generativeContent);
        const aiResponseText = result.response.text();

        socket.cultureHistory.push(`User: ${question}\nSage: ${aiResponseText}`);

        if (user) {
            await ChatHistory.create({
                toolName: "KHMER_CULTURE",
                userInput: question || "Analyzed an image",
                aiResponse: { response: aiResponseText },
                userId: user._id,
            });
        }
        socket.emit("culture_result", { response: aiResponseText });
    } catch (e) {
        socket.emit("error_occured", "លោកតាឥសីកំពុងសមាធិ ហៅអត់ឮទេ៖ " + e.message);
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
  // controller.js - STUDY_ASSISTANT update
  socket.on("study_assist", async (data) => {
    const { content, image, firebaseUid } = data; // ថែម image (base64)
    try {
      const user = await findUserByUid(firebaseUid);

      // ១. ទាញ History មកវិញខ្លះដើម្បីឱ្យវាដឹងថាទើបរៀនដល់ណា
      const history = await ChatHistory.find({
        userId: user?._id,
        toolName: "STUDY_ASSISTANT",
      })
        .sort({ createdAt: -1 })
        .limit(3);

      const historyContext = history
        .reverse()
        .map(
          (h) =>
            `Previous Lesson: ${h.userInput}\nSummary: ${h.aiResponse.summary}`,
        )
        .join("\n");

      const prompt = `You are an elite Khmer Study Buddy. 
                Context of recent studies: ${historyContext}
                
                TASK: Summarize the input and create a quiz.
                STRICT RULES:
                1. Answer in Khmer only.
                2. If the input is an image (handwritten note or textbook), analyze it carefully.
                3. Return ONLY JSON:
                {
                  "summary": "សង្ខេបឱ្យខ្លឹម និងងាយយល់បំផុត (Markdown format enabled)",
                  "key_concepts": ["...", "..."],
                  "quiz": [{"question": "...", "options": ["...", "..."], "answer": "...", "explanation": "ហេតុអ្វីបានជាចម្លើយនេះត្រឹមត្រូវ"}],
                  "funny_motivation": "ពាក្យលើកទឹកចិត្តបែបដៀមដាមតិចៗតែមានកម្លាំងចិត្ត"
                }
                Analyze: "${content}"`;

      let generativeContent = [prompt];
      if (image) {
        generativeContent.push({
          inlineData: { data: image, mimeType: "image/jpeg" },
        });
      }

      const result = await aiModel.generateContent(generativeContent);
      const aiData = parseAIJson(result.response.text());

      if (user) {
        await ChatHistory.create({
          toolName: "STUDY_ASSISTANT",
          userInput: content || "Sent an image lesson",
          aiResponse: aiData,
          userId: user._id,
        });
      }
      socket.emit("study_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "AI ចង់សន្លប់ពេលឃើញមេរៀនបង៖ " + e.message);
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

// controller.js - AI TUTOR
socket.on("ask_tutor", async (data) => {
    const { topic, image, mode, firebaseUid } = data;
    try {
        const user = await findUserByUid(firebaseUid);
        if (!user) return socket.emit("error_occured", "សូម Login សិនបង!");

        // ១. បង្កើត Session Memory (រលាយបាត់ពេល Refresh)
        socket.tutorHistory = socket.tutorHistory || [];
        const context = socket.tutorHistory.slice(-4).join("\n");

        const style = mode === "kid" ? "ពន្យល់ដូចក្មេងអាយុ ៥ ឆ្នាំ" : "ពន្យល់បែបអាជីព តែងាយយល់";
        
        const prompt = `You are an expert Khmer Teacher.
                [SESSION CONTEXT]: ${context}
                
                TASK: Explain the topic clearly and provide specific examples.
                STRICT RULES:
                1. Answer EVERYTHING in Khmer.
                2. If an image is provided (like an exercise or textbook page), analyze and explain it.
                3. Return ONLY valid JSON:
                {
                  "title": "ចំណងជើងមេរៀន",
                  "explanation": "ការបកស្រាយលម្អិត (Markdown enabled)",
                  "key_points": [{"label": "...", "desc": "..."}],
                  "examples": ["...", "..."],
                  "fun_fact": "..."
                }
                Topic: "${topic}" | Style: ${style}`;

        let generativeContent = [prompt];
        if (image) {
            generativeContent.push({ inlineData: { data: image, mimeType: "image/jpeg" } });
        }

        const result = await aiModel.generateContent(generativeContent);
        const aiData = parseAIJson(result.response.text());

        // ២. បញ្ចូលទៅក្នុង Session Memory ដើម្បីឱ្យគ្រូដឹងថាទើបពន្យល់រឿងអី
        socket.tutorHistory.push(`User asks: ${topic}\nAI explains: ${aiData.title}`);

        await ChatHistory.create({
            toolName: "AI_TUTOR",
            userInput: topic || "Analyzed an image",
            aiResponse: aiData,
            userId: user._id,
        });

        socket.emit("tutor_result", aiData);
    } catch (e) {
        socket.emit("error_occured", "គ្រូ AI គាំងខួរក្បាលបន្តិចហើយ៖ " + e.message);
    }
});

  // controller.js

  // controller.js
  socket.on("vent_out", async (data) => {
    const { message, image, firebaseUid, personality } = data;

    try {
      const user = await findUserByUid(firebaseUid);
      if (!user)
        return socket.emit("error_occured", "រកអ្នកប្រើប្រាស់មិនឃើញទេ!");

      // ១. បង្កើតកន្លែងផ្ទុក History បណ្ដោះអាសន្នលើ Socket (វានឹងរលាយបាត់ពេល Refresh)
      // យើងរក្សាទុកតែក្នុងអារេ (Array) នៃ Socket នេះប៉ុណ្ណោះ
      socket.sessionHistory = socket.sessionHistory || [];

      // ២. បណ្ណាល័យបទចម្រៀង
      const songLibrary = `
    - បទស្រឡាញ់គេម្នាក់ឯង (Sweet/Crush): "sl_ke_mneak_eng.mp3", "ពេលវេលាមិនសំ.mp3"
    - បទគេសុំបែក (Sad/Breakup): "កុំចោលបង.mp3"
    - បទឌឺដង/កាច (Rage/Roast): "លុប.mp3"
    - បទលើកទឹកចិត្ត (High Value/Strong): "ពេលវេលាមិនសំ.mp3"
    `;

      // ៣. រៀបចំ Context ចេញពី Session History (យកតែ ៦ ឃ្លាចុងក្រោយដែលទើប Chat រួច)
      const chatContext = socket.sessionHistory.slice(-6).join("\n\n");

      // ៤. កំណត់ចរិតលក្ខណៈ (Personality)
      let systemRole = "";
      if (personality === "sweet") {
        systemRole = `You are 'Sweet Angel Healer', a very gentle Khmer soul. 
                    You focus on deep emotional healing and empathy.`;
      } else {
        systemRole = `You are 'Senior Dev Healer', a witty, toxic, sarcastic Khmer mentor. 
                    If you see in context that the user was just reviewing code, roast their code and love life together!`;
      }

      // ៥. រៀបចំ Prompt ឱ្យដឹងរឿងដែលកំពុង Chat បច្ចុប្បន្ន
      const prompt = `
        ${systemRole}

        CURRENT SESSION CONTEXT (Conversation within this session):
        ${chatContext}

        Current User Input: "${message}"
        
        INSTRUCTIONS:
        - Maintain continuity with the Session Context provided above.
        - STEP 1 (The Reaction): Respond based on your personality (${personality}).
        - STEP 2 (The Truth/Advice): Help them see their value and be a High Value person.
        - STEP 3 (The Song): Pick ONE from: ${songLibrary}
        - IMPORTANT: Say "មើលតាមស្ថានភាពប្អូនសមនិងបងនេះណាស់ " before the song tag.
        - Use 2026 Khmer slang. Answer in Khmer ONLY.
        - Song format: [SONG: filename.mp3]
        `;

      // ៦. រៀបចំ Data ផ្ញើទៅ Gemini
      let generativeContent = [prompt];
      if (image) {
        generativeContent.push({
          inlineData: { data: image, mimeType: "image/jpeg" },
        });
      }

      const result = await aiModel.generateContent(generativeContent);
      const aiData = result.response.text();

      // ៧. បន្ថែមការសន្ទនាថ្មីចូលក្នុង Socket Memory (ឱ្យ AI ចាំក្នុង Chat បន្តបន្ទាប់)
      socket.sessionHistory.push(`User: ${message}`);
      socket.sessionHistory.push(`AI: ${aiData}`);

      // ៨. រក្សាទុកក្នុង Database សម្រាប់តែ Logging ប៉ុណ្ណោះ (មិនយកមកឱ្យ AI ចាំទេ)
      await ChatHistory.create({
        toolName: "LOVE_HEALER_RAGE",
        userInput: message || "Sent an image",
        aiResponse: aiData,
        userId: user._id,
      });

      socket.emit("rage_result", {
        response: aiData,
        personality: personality,
      });
    } catch (e) {
      console.error(e);
      socket.emit("error_occured", "AI គាំងព្រោះនឹកសង្សារចាស់៖ " + e.message);
    }
  });

  socket.on("disconnect", () => {
    userRateLimits.delete(socket.id); // សម្អាត memory ពេល user ចាកចេញ
    console.log("❌ Neural Connection Lost: " + socket.id);
  });
};
