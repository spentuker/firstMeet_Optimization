const Meeting = require("../models/meeting");
const mammoth = require("mammoth");
const fs = require("fs");
const { InferenceClient } = require("@huggingface/inference");

const client = new InferenceClient(process.env.HF_API_KEY);


exports.createMeeting = async (req, res) => {
    try {
        const { title, userName, summary, actionItems } = req.body;
        const meeting = new Meeting({ title, userName, summary, actionItems });
        await meeting.save();
        res.status(201).json(meeting);
    } catch (error) {
        console.error("Create Meeting Error:", error);
        res.status(400).json({ message: error.message });
    }
};


exports.getMeetingsByUser = async (req, res) => {
    try {
        const { userName } = req.params;
        const meetings = await Meeting.find({ userName }).sort({ createdAt: -1 });
        res.json(meetings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.analyzeMeeting = async (req, res) => {
    try {
        const prompt = req.body.prompt;
        const filePath = req.file.path;


        let fileText = "";
        if (req.file.originalname.endsWith(".docx")) {
            const result = await mammoth.extractRawText({ path: filePath });
            fileText = result.value;
        } else {
            fileText = fs.readFileSync(filePath, "utf8");
        }


        const response = await client.chatCompletion({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: [
                { role: "system", content: "You are a professional meeting analysis assistant. You MUST respond with exactly two sections delimited by [[SUMMARY]] and [[ACTION_ITEMS]]. Do NOT include action items in the Summary section. Use only plain text, no bolding or asterisks." },
                { role: "user", content: `${prompt}\n\nMeeting Notes / Transcript:\n${fileText}` }
            ],
            max_tokens: 2500,
        });

        const summaryData = response.choices[0].message.content;


        res.send(summaryData);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (err) {
        console.error("HF API Error:", err);
        if (err.httpResponse && err.httpResponse.body) {
            console.error("HF API Error Details:", JSON.stringify(err.httpResponse.body, null, 2));
            res.status(500).json({ error: "Hugging Face API Error", details: err.httpResponse.body });
        } else {
            res.status(500).send("Server Error");
        }
    }
};
