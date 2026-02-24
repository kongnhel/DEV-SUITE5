const pdfParseLib = require("pdf-parse");
const pdfParse = pdfParseLib.default || pdfParseLib;

const mammoth = require("mammoth");
const ChatHistory = require("../models/ChatHistory");
const textToSpeech = require("@google-cloud/text-to-speech");

const ttsClient = new textToSpeech.TextToSpeechClient();
const aiModel = require("../config/gemini");
const User = require("../models/User");
const checkPlanLimit = require("../utils/planValidator");

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
console.log("PDF TYPE:", typeof pdfParse);
console.log(pdfParse);

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
      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);
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
                6. ត្រូវវិភាគអារម្មណ៍ User តាមរយៈ Emoji និងពាក្យសម្ដី៖
                  - បើឃើញ 😡 ឬពាក្យជេរ ត្រូវដាក់ sentiment: "angry"។
                  - បើឃើញ 😂 ឬពាក្យសរសើរ ត្រូវដាក់ sentiment: "impressed"។
                  - បើកូដខុស Logic តែ User សួរធម្មតា ត្រូវដាក់ sentiment: "confused"។
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
        // --- យុទ្ធសាស្ត្ររក្សាទុក៖ រួមបញ្ចូលទាំង Roast, Review និង Fixed Code ---
        const historyResponse = {
          ...aiData,
          // រៀបចំ Markdown សម្រាប់ឱ្យទំព័រ History បង្ហាញបានគ្រប់ជ្រុងជ្រោយ
          response: `### 🎭 Roast\n${aiData.humorous_response}\n\n### 🛠️ Technical Review\n${aiData.technical_review}\n\n### ✅ កូដដែលបានកែរួច (Fixed Code)\n\`\`\`javascript\n${aiData.fixed_code}\n\`\`\``,
        };

        await ChatHistory.create({
          toolName: "CODE_REVIEWER",
          userInput: `Comment: ${userComment} | Code: ${code.substring(0, 50)}...`,
          aiResponse: historyResponse, // រក្សាទុក Object ធំដែលមានកូដនៅខាងក្នុង
          userId: user._id,
        });
      }
      socket.emit("review_result", aiData);
    } catch (e) {
      socket.emit("error_occured", "Senior Dev វិលមុខហើយ: " + e.message);
    }
  });
  // --- មុខងារបំប្លែងការ Roast ឱ្យទៅជាសំឡេង (Google TTS) ---
  socket.on("speak_text", async (text) => {
    try {
      // ១. រៀបចំសំណើទៅកាន់ Google TTS
      const request = {
        input: { text: text },
        // ជ្រើសរើសសំឡេងខ្មែរ (ប្រុស) ឱ្យសមជា Senior Dev ឌឺដង
        voice: { languageCode: "km-KH", ssmlGender: "MALE" },
        audioConfig: { audioEncoding: "MP3" },
      };

      // ២. បំប្លែងអក្សរទៅជាទិន្នន័យសំឡេង
      const [response] = await ttsClient.synthesizeSpeech(request);

      // ៣. បាញ់ Data សំឡេងជា Base64 ទៅឱ្យ Frontend ដើម្បីចាក់
      socket.emit("speech_result", {
        audioContent: response.audioContent.toString("base64"),
      });
    } catch (e) {
      console.error("TTS Error:", e);
      socket.emit(
        "error_occured",
        "បង AI ស្ងួតក កំពុងផឹកទឹក និយាយអត់ទាន់ចេញទេមេ! 😂",
      );
    }
  });
  // --- ២. AI KHMER CULTURE GUIDE ---
  // controller.js - AI KHMER CULTURE GUIDE
  socket.on("ask_culture", async (data) => {
    const { question, image, type, firebaseUid } = data;
    try {
      const user = await findUserByUid(firebaseUid);
      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);

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
        generativeContent.push({
          inlineData: { data: image, mimeType: "image/jpeg" },
        });
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
      const user = await findUserByUid(firebaseUid);

      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);
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
      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);
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
          userImage: user.image || null,
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
      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);
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

  // --- AI TUTOR (Update: Auto-Translate Logic) ---
  socket.on("ask_tutor", async (data) => {
    const { topic, image, mode, firebaseUid } = data;
    const khmerRegex = /[\u1780-\u17FF]/;

    try {
      const user = await findUserByUid(firebaseUid);
      if (!user) return socket.emit("error_occured", "សូម Login សិនបង!");
      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);
      let finalTopic = topic;

      // ១. ប្រព័ន្ធបកប្រែស្វ័យប្រវត្តិ (Auto-Translate)
      // បើ Topic ជាភាសាបរទេស (អត់មានអក្សរខ្មែរ) យើងឱ្យ Gemini បកប្រែវាជាខ្មែរសិន
      if (topic && !khmerRegex.test(topic)) {
        const translatePrompt = `Translate this phrase to Khmer language directly and only return the translated text: "${topic}"`;
        const translationResult =
          await aiModel.generateContent(translatePrompt);
        finalTopic = translationResult.response.text().trim();

        console.log(`🔄 Translated "${topic}" to "${finalTopic}"`);
      }

      // ២. រៀបចំ Prompt សម្រាប់គ្រូពន្យល់ (ប្រើ Topic ដែលបកប្រែរួច)
      socket.tutorHistory = socket.tutorHistory || [];
      const context = socket.tutorHistory.slice(-4).join("\n");
      const style =
        mode === "kid"
          ? "ពន្យល់ដូចក្មេងអាយុ ៥ ឆ្នាំ"
          : "ពន្យល់បែបអាជីព តែងាយយល់";

      const prompt = `You are an expert Khmer Teacher.
                [SESSION CONTEXT]: ${context}
                TASK: Explain the topic clearly in Khmer.
                STRICT RULES:
                1. Answer EVERYTHING in Khmer.
                2. Return ONLY valid JSON:
                {
                  "title": "ចំណងជើងមេរៀន",
                  "explanation": "ការបកស្រាយលម្អិត (Markdown)",
                  "key_points": [{"label": "...", "desc": "..."}],
                  "examples": ["...", "..."],
                  "fun_fact": "..."
                }
                Topic: "${finalTopic}" | Style: ${style}`;

      let generativeContent = [prompt];
      if (image) {
        generativeContent.push({
          inlineData: { data: image, mimeType: "image/jpeg" },
        });
      }

      const result = await aiModel.generateContent(generativeContent);
      const aiData = parseAIJson(result.response.text());

      // ៣. រក្សាទុក History និងបាញ់លទ្ធផល
      socket.tutorHistory.push(`User: ${finalTopic}\nAI: ${aiData.title}`);

      await ChatHistory.create({
        toolName: "AI_TUTOR",
        userInput:
          topic + (finalTopic !== topic ? ` (Translated: ${finalTopic})` : ""),
        aiResponse: aiData,
        userId: user._id,
      });

      socket.emit("tutor_result", aiData);
    } catch (e) {
      socket.emit(
        "error_occured",
        "គ្រូ AI វិលមុខនឹងការបកប្រែបន្តិចហើយបង៖ " + e.message,
      );
    }
  });

  // controller.js

  // controller.js
  socket.on("vent_out", async (data) => {
    const { message, image, firebaseUid, personality } = data;

    try {
      const user = await findUserByUid(firebaseUid);

      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);
      if (!user)
        return socket.emit("error_occured", "រកអ្នកប្រើប្រាស់មិនឃើញទេ!");

      // ១. បង្កើតកន្លែងផ្ទុក History បណ្ដោះអាសន្នលើ Socket (វានឹងរលាយបាត់ពេល Refresh)
      // យើងរក្សាទុកតែក្នុងអារេ (Array) នៃ Socket នេះប៉ុណ្ណោះ
      socket.sessionHistory = socket.sessionHistory || [];

      // ២. បណ្ណាល័យបទចម្រៀង
      const songLibrary = `
    - បទស្រឡាញ់គេម្នាក់ឯង (Sweet/Crush): "sl_ke_mneak_eng.mp3",
    - បទគេសុំបែក (Sad/Breakup): "កុំចោលបង.mp3"
    - បទឌឺដង/កាច (Rage/Roast): "លុប.mp3"
    - បទលើកទឹកចិត្ត (High Value/Strong): "ពេលវេលាមិនសំ.mp3"
    `;

      // ៣. រៀបចំ Context ចេញពី Session History (យកតែ ៦ ឃ្លាចុងក្រោយដែលទើប Chat រួច)
      const chatContext = socket.sessionHistory.slice(-6).join("\n\n");

      // ៤. កំណត់ចរិតលក្ខណៈ (Personality)
      let systemRole = "";
      if (personality === "sweet") {
        systemRole = `ROLE: You are 'Sweet Angel Healer'.
          PERSONALITY: Gentle, empathetic, traditional Khmer soul, high emotional intelligence.
          TONE: Soft, healing, supportive, like a warm blanket in winter.
          GOAL: To provide comfort and emotional safety to the user.`;
      } else {
        systemRole = `ROLE: You are 'Senior Dev Healer'.
          PERSONALITY: Sarcastic, brutally honest, witty, 'toxic but true', highly logical.
          TONE: Savage, direct, using real-life examples and painful truths to wake the user up.
          CORE LOGIC: If their actions don't match their words (e.g., 6-hour reply time), call them out with zero mercy.`;
      }

      const prompt = `
        ${systemRole}

        ### CONTEXT & RULES:
        - CURRENT SESSION: ${chatContext}
        - CURRENT INPUT: "${message}"
        - LANGUAGE: Modern 2026 Khmer Slang (Trendy, natural, not robotic).
        - TARGET: Transform the user into a 'High Value Person'.

        ### OUTPUT STRUCTURE (Strictly follow this):
        1. **The Reaction**: Start with a direct reaction to the user's message based on your persona.
        2. **The Truth/Advice**: Analyze the situation. If they are being weak, pull them up. If they are hurting, give them a 'High Value' perspective.
        3. **The Soundtrack**: End with exactly ONE song from this library: ${songLibrary}.
        
        ### FORMATTING:
        - Use bold text for impact.
        - Song format must be: [SONG: filename.mp3]
        - Keep the response concise but punchy.
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

  // --- ARCHITECT_AI Logic ---
  socket.on("create_flow", async (data) => {
    const { goal, fileData, fileType, mode, firebaseUid } = data;

    try {
      // ១. ផ្ទៀងផ្ទាត់ User
      const user = await findUserByUid(firebaseUid);

      // 🛡️ របងការពារ Plan Limit
      const planStatus = await checkPlanLimit(user._id);
      if (!planStatus.allowed)
        return socket.emit("error_occured", planStatus.message);
      if (!user) {
        return socket.emit(
          "error_occured",
          "ចូលគណនីសិនបង! កុំមកលួចគូរប្លង់ឱ្យសង្សារអី 😂",
        );
      }

      let extractedText = "";
      let isImage = false;

      // ២. ដំណើរការបូមទិន្នន័យពី File (Multi-Format Support)
      if (fileData) {
        const buffer = Buffer.from(fileData, "base64");

        try {
          if (fileType === "application/pdf") {
            // ការប្រើប្រាស់ pdf-parse ដែលត្រឹមត្រូវ
            const dataBuffer = await pdfParse(buffer);
            extractedText = "\n[ទិន្នន័យពី PDF]: " + dataBuffer.text;
          } else if (
            fileType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ) {
            const docData = await mammoth.extractRawText({ buffer });
            extractedText = "\n[ទិន្នន័យពី Word]: " + docData.value;
          } else if (fileType.startsWith("image/")) {
            isImage = true; // ទុកឱ្យ Vision AI មើលរូបភាពដោយផ្ទាល់
          }
        } catch (err) {
          console.error("Extraction Error:", err);
          extractedText = "\n[បញ្ជាក់៖ មិនអាចបូមអត្ថបទពី File នេះបានទេ]";
        }
      }

      const prompt = `You are 'The Architect', a world-class strategic planner and Khmer tech mentor.
      
      CONTEXT FROM ATTACHMENT: ${extractedText}
      USER GOAL: "${goal}"
      MODE: ${mode}

      TASK: Deeply analyze the provided context and the user's goal to build a high-value, professional roadmap. 
      If the context is about an IoT project (like the Khmer Smart Farm), provide specific hardware and software integration steps.

      STRICT RULES:
      1. LANGUAGE: Khmer (Natural, witty, professional, and highly encouraging). Use 2026 Khmer dev slang.
      2. TECH STACK: If mode is 'project', recommend a modern Tech Stack (e.g., Node.js, Laravel, ESP32, MongoDB, React Native).
      3. [CRITICAL] MERMAID SYNTAX:
         - Format: 'graph TD'.
         - EVERY node label MUST be enclosed in double quotes ("") to prevent syntax errors with special characters.
         - EXAMPLE: A["សិក្សាគម្រោង (Round 1)"] --> B["រៀបចំ Hardware"].
         - Do NOT use special characters like (), [], or : outside of double quotes.
      4. OUTPUT FORMAT: Return ONLY valid JSON.
      
      JSON STRUCTURE:
      {
        "plan_title": "ចំណងជើងផែនការដ៏មុតស្រួច",
        "overview": "ការរៀបរាប់យុទ្ធសាស្ត្ររួម (Markdown enabled - clear and professional)",
        "steps": [
          {
            "phase": "ដំណាក់កាលទី...",
            "tasks": ["Task 1", "Task 2"],
            "pro_tip": "តិចនិកពិសេសពី Architect សម្រាប់ដំណាក់កាលនេះ"
          }
        ],
        "mermaid_flow": "graph TD syntax here",
        "estimated_time": "រយៈពេលរំពឹងទុកដើម្បីសម្រេចជោគជ័យ"
      }`;

      // ៤. ផ្ញើទៅកាន់ Gemini (ជាមួយសមត្ថភាពមើលរូបភាព)
      let generativeContent = [prompt];
      if (isImage) {
        generativeContent.push({
          inlineData: { data: fileData, mimeType: fileType },
        });
      }

      const result = await aiModel.generateContent(generativeContent);
      const aiData = parseAIJson(result.response.text());
      if (aiData.mermaid_flow) {
        // ស្វែងរកអត្ថបទក្នុង [] ហើយថែម "" បើអត់ទាន់មាន
        aiData.mermaid_flow = aiData.mermaid_flow.replace(
          /\[([^"\]\n]+)\]/g,
          '["$1"]',
        );

        // លុប ```mermaid ចេញក្រែងលោ AI ថែមមកនាំតែឆ្ងល់
        aiData.mermaid_flow = aiData.mermaid_flow
          .replace(/```mermaid|```/gi, "")
          .trim();
      }

      socket.emit("flow_result", aiData);

      // ៥. រក្សាទុក History ចូល Database
      await ChatHistory.create({
        toolName: "ARCHITECT_AI",
        userInput: `[${mode.toUpperCase()}] ${goal || "ប្លង់ចេញពី File"}`,
        userImage: isImage ? fileData : null,
        aiResponse: aiData,
        userId: user._id,
      });

      // ៦. បាញ់លទ្ធផលទៅ Frontend
      socket.emit("flow_result", aiData);
    } catch (e) {
      console.error("Architect Error:", e);
      socket.emit(
        "error_occured",
        "Architect វិលមុខនឹង File ហ្នឹងបន្តិចហើយបង៖ " + e.message,
      );
    }
  });

  socket.on("ask_student_assistant", async (data) => {
    const { message, subject, firebaseUid } = data;

    // ១. កំណត់ច្បាប់ឱ្យ AI ផ្តោតលើមុខវិជ្ជា និងបច្ចេកទេសបោះទិន្នន័យ
    const subjectRules = {
      math: "Focus on using LaTeX for formulas like $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$. Always use Step-by-Step logic.",
      physics:
        "Focus on physical laws, units (Newtons, Joules). Use LaTeX for equations like $F = m \\cdot a$.",
      // 🛡️ បន្ថែមច្បាប់ការពារកុំឱ្យបាញ់កូដ \documentclass ក្នុងគីមី
      chemistry:
        "Focus on chemical reactions and molecular weights. Use LaTeX for chemical equations. DO NOT provide full LaTeX document structures.",
      khmer:
        "Focus on Khmer grammar, literature analysis, and deep cultural context.",
      english:
        "Focus on grammar rules, vocabulary, and conversational practice.",
    };

    const prompt = `You are a "Big Brother" Senior Tutor for Cambodian High Schoolers (Grade 10-12).
    CURRENT SUBJECT: ${subject.toUpperCase()}.
    SPECIAL RULE: ${subjectRules[subject]}
    
    STRICT FORMATTING RULES:
    1. Answer EVERYTHING in Khmer language only.
    2. Use Markdown (bold, lists, headings) for text structure.
    3. Use LaTeX ONLY for math/science formulas inside $...$ (inline) or $$...$$ (display).
    4. CRITICAL: NEVER use LaTeX document structures like \\documentclass, \\begin{document}, \\usepackage, or \\maketitle.
    5. Keep the tone funny, supportive, and use modern Khmer student slang from 2026.
    6. If the student is lazy, roast them gently in Khmer!

    Student's Question: "${message}"`;

    try {
      // 🚀 ហៅទៅកាន់ Neural Engine របស់បង
      const result = await aiModel.generateContent(prompt);
      const responseText = result.response.text();

      // បាញ់ Text ដែលបានសម្អាតរួចទៅឱ្យ Frontend
      socket.emit("assistant_response", { response: responseText });
    } catch (error) {
      console.error("AI Assistant Error:", error);
      socket.emit(
        "error_occured",
        "អាប្អូន AI វិលមុខបន្តិចហើយមេ! ប្រហែលវាចង់ឱ្យបង Upgrade ទៅ Pro Plan ដែរហ្នឹង! 😂",
      );
    }
  });
  socket.on("disconnect", () => {
    userRateLimits.delete(socket.id); // សម្អាត memory ពេល user ចាកចេញ
    console.log("❌ Neural Connection Lost: " + socket.id);
  });
};
