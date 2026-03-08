const Meeting = require("../models/meeting");


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
