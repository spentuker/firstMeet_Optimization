const express = require("express");
const multer  = require("multer");
const {
    chatMessage,
    analyzeDocument,
    extractText,
    getChatHistory,
    appendChatHistory,
    clearChatHistory,
} = require("../controllers/chatController");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// POST /api/chat/message  — conversational turn
router.post("/message", chatMessage);

// POST /api/chat/document — full document analysis (.txt, .docx)
router.post("/document", upload.single("file"), analyzeDocument);

// POST /api/chat/extract-text — extract raw text only (for doc Q&A)
router.post("/extract-text", upload.single("file"), extractText);

// GET    /api/chat/history?userName=X
router.get("/history", getChatHistory);

// POST   /api/chat/history/append
router.post("/history/append", appendChatHistory);

// DELETE /api/chat/history?userName=X
router.delete("/history", clearChatHistory);

module.exports = router;
