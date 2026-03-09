const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    role:      { type: String, enum: ["user", "assistant"], required: true },
    content:   { type: String, default: "" },
    type:      { type: String, default: "text" },
    isWelcome: { type: Boolean, default: false },
    navTarget: { type: String, default: null },
    insight:   { type: mongoose.Schema.Types.Mixed, default: null },
    fileName:  { type: String, default: null },
    fileInfo:  { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
});

const chatHistorySchema = new mongoose.Schema({
    userName: { type: String, required: true, unique: true, index: true },
    messages: { type: [messageSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
