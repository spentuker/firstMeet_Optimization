const Task        = require("../models/tasks");
const Meeting     = require("../models/meeting");
const User        = require("../models/user");
const ChatHistory = require("../models/chatHistory");
const { InferenceClient } = require("@huggingface/inference");
const mammoth = require("mammoth");
const fs      = require("fs");

const client = new InferenceClient(process.env.HF_API_KEY);

// ─── Intent Detection ─────────────────────────────────────────────────────────

const detectIntent = (message) => {
    const m = message.toLowerCase().trim();

    if (/\b(my meetings?|meeting history|show meetings?|list meetings?|all meetings?)\b/.test(m))
        return "my_meetings";

    if (/\b(my completed tasks?|finished tasks?|what (have i|did i) complet)\b/.test(m))
        return "completed_tasks";

    if (/\b(my tasks?|pending tasks?|open tasks?|what.?s due|due (today|this week|soon)|tasks? (assigned|for me)|show tasks?)\b/.test(m))
        return "my_tasks";

    if (/\b(team (performance|analytics?|stats?|velocity|overview)|company.?(wide|analytics?)|whole team|all members?|top performers?)\b/.test(m))
        return "team_analytics";

    if (/\b(my (analytics?|stats?|performance|dashboard|metrics?|numbers?|score|focus|impact)|how am i (doing|performing)|my overview)\b/.test(m))
        return "my_analytics";

    if (/\b(weekly digest|generate digest|this week.?s (performance|summary|report)|team (summary|report))\b/.test(m))
        return "weekly_digest";

    if (/\b(find|search|look for|meetings? about|meetings? (related|regarding|on topic))\b/.test(m))
        return "search_meetings";

    if (/\b(go to|open|navigate|take me to|show me the)\b.+\b(analytics?|dashboard|meetings? page|tasks?|email|jira|history|completed)\b/.test(m))
        return "navigate";

    if (/\b(tell me about|what happened in|summarize|summary of|details? (of|about)|action items? (from|in|for)|insights? (from|about)|who was (in|at|assigned))\b/.test(m))
        return "meeting_detail";

    if (/\b(ask questions?|qa|q&a|quiz|discuss|talk about|chat about)\b.*(meeting|minutes|transcript)/i.test(m) ||
        /\bi want to (ask|query|discuss|talk|chat).*(my |a )?(meeting|meetings?|minutes?)/i.test(m) ||
        /\bquestions? about (my |a )?(meeting|meetings?)/i.test(m))
        return "meeting_qa_select";

    return "general";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractKeyword = (message) => {
    const stopWords = new Set(["find","search","look","for","locate","meetings","meeting","about","related","to","regarding","on","discussing","show","me","a","the","of","in","at","from","that","with","is"]);
    return message.toLowerCase().split(/\s+/).filter(w => !stopWords.has(w)).join(" ").trim() || message;
};

// ─── CHAT MESSAGE ─────────────────────────────────────────────────────────────

exports.chatMessage = async (req, res) => {
    try {
        const { message, userName, userRole, history = [], docContext, meetingContext } = req.body;
        if (!message || !userName) return res.status(400).json({ message: "message and userName required" });

        // If user is in a Q&A context (doc or meeting), skip intent detection and answer directly
        const intent = (docContext || meetingContext) ? "general" : detectIntent(message);
        let contextData = null;
        let contextText = "";
        let responseType = "text";
        let navTarget = null;

        // ── Fetch data based on intent ──────────────────────────────────────

        if (intent === "my_meetings") {
            const meetings = await Meeting.find({ userName }).sort({ createdAt: -1 }).limit(10).lean();
            contextData = meetings.map(m => ({
                _id:              m._id,
                title:            m.title,
                summary:          m.summary,
                actionItemsCount: (m.actionItems || []).length,
                createdAt:        m.createdAt,
            }));
            contextText = `${userName} has ${meetings.length} meetings. Recent: ` +
                meetings.slice(0, 5).map(m => `"${m.title}" (${new Date(m.createdAt).toLocaleDateString()}, ${(m.actionItems || []).length} action items)`).join("; ");
            responseType = "meetings";
        }

        else if (intent === "meeting_detail") {
            const nameMatch = message.match(/(?:about|in|for|of|from)\s+[""']?([^""'?.!]+)[""']?/i);
            const keyword   = nameMatch ? nameMatch[1].trim() : extractKeyword(message);
            const regex     = new RegExp(keyword.split(" ").join("|"), "i");
            const found     = await Meeting.find({
                userName,
                $or: [{ title: regex }, { summary: regex }, { "actionItems.task": regex }, { "actionItems.title": regex }],
            }).sort({ createdAt: -1 }).limit(1).lean();

            const meeting = found[0] || (await Meeting.find({ userName }).sort({ createdAt: -1 }).limit(1).lean())[0];
            if (meeting) {
                contextData = meeting;
                contextText = `Meeting: "${meeting.title}" on ${new Date(meeting.createdAt).toLocaleDateString()}.\nSummary: ${meeting.summary || "N/A"}.\nAction Items: ${(meeting.actionItems || []).map(a => `${a.task || a.title} → ${a.assignedTo || "TBD"}`).join("; ") || "None"}`;
                responseType = "meeting_detail";
            }
        }

        else if (intent === "my_tasks") {
            const tasks    = await Task.find({ assignedTo: userName }).sort({ createdAt: -1 }).lean();
            const pending   = tasks.filter(t => !t.isCompleted);
            const completed = tasks.filter(t => t.isCompleted);
            contextData = { pending, completed };
            contextText = `${userName}'s tasks — Pending (${pending.length}): ${pending.map(t => `${t.title} [${t.priority}]${t.deadline ? " due " + t.deadline : ""}`).join("; ") || "None"}. Completed: ${completed.length}`;
            responseType = "tasks";
        }

        else if (intent === "completed_tasks") {
            const tasks     = await Task.find({ assignedTo: userName, isCompleted: true }).sort({ updatedAt: -1 }).lean();
            contextData = { pending: [], completed: tasks };
            contextText = `${userName} has completed ${tasks.length} tasks: ${tasks.map(t => t.title).join("; ") || "None"}`;
            responseType = "tasks";
        }

        else if (intent === "team_analytics") {
            if (userRole !== "admin") {
                return res.json({ reply: "Team analytics are only available to admins. Would you like to see your personal stats instead?", type: "text" });
            }
            const allTasks   = await Task.find().lean();
            const allMeetings = await Meeting.find().lean();
            const users       = await User.find({ role: "employee" }).lean();
            const completed   = allTasks.filter(t => t.isCompleted).length;
            const rate        = allTasks.length > 0 ? Math.round(completed / allTasks.length * 100) : 0;
            const highP       = allTasks.filter(t => !t.isCompleted && t.priority === "HIGH").length;
            const members     = users.map(u => {
                const ut   = allTasks.filter(t => t.assignedTo === u.userName);
                const comp = ut.filter(t => t.isCompleted).length;
                return { name: u.userName, total: ut.length, completed: comp, ratio: ut.length > 0 ? Math.round(comp / ut.length * 100) : 0 };
            }).sort((a, b) => b.ratio - a.ratio);
            contextData = { completionRate: rate, totalTasks: allTasks.length, totalMeetings: allMeetings.length, highPriority: highP, members };
            contextText = `Team overview: ${allTasks.length} total tasks, ${rate}% completion, ${highP} HIGH-priority open, ${allMeetings.length} total meetings. Top: ${members[0]?.name} (${members[0]?.ratio}%)`;
            responseType = "team_stats";
        }

        else if (intent === "my_analytics") {
            const myTasks    = await Task.find({ assignedTo: userName }).lean();
            const myMeetings = await Meeting.find({ userName }).lean();
            const completed  = myTasks.filter(t => t.isCompleted);
            const pending    = myTasks.filter(t => !t.isCompleted);
            const rate       = myTasks.length > 0 ? Math.round(completed.length / myTasks.length * 100) : 0;
            const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);
            const cTW        = myTasks.filter(t => t.isCompleted && new Date(t.updatedAt) >= weekStart).length;
            const aTW        = myTasks.filter(t => new Date(t.createdAt) >= weekStart).length;
            const focus      = aTW > 0 ? Math.round(cTW / aTW * 100) : cTW > 0 ? 100 : 0;
            contextData = { rate, pendingCount: pending.length, completedCount: completed.length, meetingsCount: myMeetings.length, focusScore: focus, completedThisWeek: cTW, assignedThisWeek: aTW };
            contextText = `${userName}'s analytics: ${rate}% completion, ${pending.length} pending, ${completed.length} done, ${myMeetings.length} meetings attended, weekly focus ${focus}%`;
            responseType = "my_stats";
        }

        else if (intent === "weekly_digest") {
            const now       = new Date();
            const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
            const wTasks    = await Task.find({ createdAt: { $gte: weekStart } }).lean();
            const wMeetings = await Meeting.find({ createdAt: { $gte: weekStart } }).lean();
            const open      = await Task.find({ isCompleted: false }).lean();
            const cTW       = wTasks.filter(t => t.isCompleted).length;
            const highP     = open.filter(t => t.priority === "HIGH").length;
            contextText     = `Weekly stats for digest: ${cTW} tasks completed, ${wTasks.length} tasks created, ${highP} HIGH-priority open, ${wMeetings.length} meetings this week. Write a 3-sentence plain-English digest.`;
            responseType    = "digest";
        }

        else if (intent === "search_meetings") {
            const keyword = extractKeyword(message);
            const regex   = new RegExp(keyword.split(" ").join("|"), "i");
            const query   = userRole === "admin"
                ? { $or: [{ title: regex }, { summary: regex }] }
                : { userName, $or: [{ title: regex }, { summary: regex }] };
            const found   = await Meeting.find(query).sort({ createdAt: -1 }).limit(6).lean();
            contextData   = found.map(m => ({
                _id:              m._id,
                title:            m.title,
                summary:          m.summary,
                actionItemsCount: (m.actionItems || []).length,
                createdAt:        m.createdAt,
            }));
            contextText = found.length > 0
                ? `Found ${found.length} meetings matching "${keyword}": ${found.map(m => `"${m.title}"`).join(", ")}`
                : `No meetings found matching "${keyword}".`;
            responseType = "meetings";
        }

        else if (intent === "navigate") {
            const m = message.toLowerCase();
            if (/analytics?|dashboard/.test(m))      navTarget = "/analytics";
            else if (/new meeting|create meeting/.test(m)) navTarget = "/meeting";
            else if (/meeting/.test(m))               navTarget = "/meeting";
            else if (/completed/.test(m))             navTarget = "/completed";
            else if (/email/.test(m))                 navTarget = "/email";
            else if (/jira/.test(m))                  navTarget = "/jira";
            else                                       navTarget = "/home";
            contextText  = `User wants to navigate to ${navTarget}. Confirm you will take them there now.`;
            responseType = "nav";
        }

        else if (intent === "meeting_qa_select") {
            const meetings = await Meeting.find({ userName })
                .sort({ createdAt: -1 })
                .select({ title: 1, summary: 1, actionItems: 1, createdAt: 1 })
                .lean();
            contextData  = meetings;
            contextText  = `${userName} wants to ask questions about their meetings. Show them the meeting picker so they can choose.`;
            responseType = "meeting_picker";
        }

        // ── Build Qwen messages ──────────────────────────────────────────────

        // Inject Q&A context if the user is in doc or meeting Q&A mode
        let fullContext = contextText;
        if (docContext) {
            fullContext = `The user is asking questions about a document. Answer ONLY based on the document content below.\n\nDocument:\n${docContext.slice(0, 5000)}`;
        } else if (meetingContext) {
            const meetings = Array.isArray(meetingContext) ? meetingContext : [meetingContext];
            const mtxt = meetings.map(m =>
                `Meeting: "${m.title}"\nSummary: ${m.summary || 'N/A'}\nAction Items: ${(m.actionItems || []).map(a => `${a.task || a.title} → ${a.assignedTo || 'TBD'}`).join('; ') || 'None'}`
            ).join('\n\n---\n\n');
            fullContext = `The user is asking questions about the following meeting(s). Answer based on this data:\n\n${mtxt}`;
        }

        const systemPrompt = `You are FirstMeet AI, a smart productivity assistant embedded in the MeetUp meeting intelligence platform. You help ${userName} (role: ${userRole}) manage meetings, tasks, and analytics. Be concise, direct, and friendly. Today is ${new Date().toLocaleDateString()}.${fullContext ? "\n\nContext: " + fullContext : ""}`;

        const qwenMessages = [
            { role: "system", content: systemPrompt },
            ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
            { role: "user", content: message },
        ];

        const response = await client.chatCompletion({
            model:      "Qwen/Qwen2.5-72B-Instruct",
            messages:   qwenMessages,
            max_tokens: (docContext || meetingContext) ? 600 : 380,
        });

        const reply = response.choices[0].message.content.trim();
        res.json({ reply, type: responseType, data: contextData, navTarget });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ message: "Chat error", error: error.message });
    }
};

// ─── DOCUMENT ANALYSIS ────────────────────────────────────────────────────────

exports.analyzeDocument = async (req, res) => {
    try {
        const { userName } = req.body;
        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file uploaded" });

        let text = "";
        const name = file.originalname.toLowerCase();

        if (name.endsWith(".docx")) {
            const result = await mammoth.extractRawText({ path: file.path });
            text = result.value;
        } else if (name.endsWith(".txt")) {
            text = fs.readFileSync(file.path, "utf8");
        } else {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ message: "Only .txt and .docx files are supported" });
        }

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        const truncated = text.slice(0, 6000);

        const response = await client.chatCompletion({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: [
                {
                    role:    "system",
                    content: `You are FirstMeet AI, a meeting intelligence assistant. Analyze the document and return ONLY a valid JSON object with exactly these 4 keys: "summary" (string, 2-3 sentences), "keyDecisions" (array of strings), "actionItems" (array of objects with "task" string and "assignedTo" string — use "TBD" if not specified), "risks" (array of strings). No markdown, no code blocks, no explanation — pure JSON only.`,
                },
                {
                    role:    "user",
                    content: `Analyze this document:\n\n${truncated}`,
                },
            ],
            max_tokens: 700,
        });

        const raw = response.choices[0].message.content.trim();
        let insight;
        try {
            const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
            insight = JSON.parse(cleaned);
        } catch {
            insight = { summary: raw, keyDecisions: [], actionItems: [], risks: [] };
        }

        res.json({ type: "insight", insight, fileName: file.originalname });

    } catch (error) {
        console.error("Document analysis error:", error);
        res.status(500).json({ message: "Document analysis error", error: error.message });
    }
};

// ─── CHAT HISTORY ─────────────────────────────────────────────────────────────

// GET /api/chat/history?userName=X
exports.getChatHistory = async (req, res) => {
    try {
        const { userName } = req.query;
        if (!userName) return res.status(400).json({ message: "userName required" });
        const record = await ChatHistory.findOne({ userName });
        res.json({ messages: record?.messages || [] });
    } catch (err) {
        res.status(500).json({ message: "Error fetching chat history", error: err.message });
    }
};

// POST /api/chat/history/append  — push an array of messages
exports.appendChatHistory = async (req, res) => {
    try {
        const { userName, messages } = req.body;
        if (!userName || !Array.isArray(messages) || messages.length === 0)
            return res.status(400).json({ message: "Invalid payload" });

        // Cap total stored messages at 100
        const record = await ChatHistory.findOne({ userName });
        const current = record?.messages || [];
        const combined = [...current, ...messages].slice(-100);

        await ChatHistory.findOneAndUpdate(
            { userName },
            { messages: combined },
            { upsert: true, new: true }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: "Error saving history", error: err.message });
    }
};

// DELETE /api/chat/history?userName=X
exports.clearChatHistory = async (req, res) => {
    try {
        const { userName } = req.query;
        if (!userName) return res.status(400).json({ message: "userName required" });
        await ChatHistory.findOneAndUpdate(
            { userName },
            { messages: [] },
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: "Error clearing history", error: err.message });
    }
};

// ─── EXTRACT TEXT (for doc Q&A) ───────────────────────────────────────────────

exports.extractText = async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file uploaded" });

        let text = "";
        const name = file.originalname.toLowerCase();

        if (name.endsWith(".docx")) {
            const result = await mammoth.extractRawText({ path: file.path });
            text = result.value;
        } else if (name.endsWith(".txt")) {
            text = fs.readFileSync(file.path, "utf8");
        } else {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ message: "Only .txt and .docx files are supported" });
        }

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.json({ text: text.slice(0, 8000) });
    } catch (err) {
        console.error("Extract text error:", err);
        res.status(500).json({ message: "Error extracting text", error: err.message });
    }
};
