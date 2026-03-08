const Task = require("../models/tasks");
const User = require("../models/user");


exports.createTask = async (req, res) => {
    try {
        const { title, userName, assignedTo, assignedBy, deadline, isAssigned, priority } = req.body;
        const newTask = new Task({
            title,
            userName,
            assignedTo,
            assignedBy,
            deadline,
            isAssigned: isAssigned !== undefined ? isAssigned : false,
            priority: priority || "MEDIUM"
        });
        await newTask.save();
        res.status(201).json(newTask);
    } catch (error) {
        console.error("Create Task Error:", error);
        res.status(400).json({ message: error.message });
    }
};


exports.getUnassignedTasks = async (req, res) => {
    try {
        const { userName } = req.query;
        const filter = { isAssigned: false };
        if (userName) filter.userName = userName;
        const tasks = await Task.find(filter);
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getTasksByUser = async (req, res) => {
    try {
        const { username } = req.params;
        const tasks = await Task.find({ assignedTo: username, isAssigned: true, isCompleted: false });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getTasksByCreator = async (req, res) => {
    try {
        const { userName } = req.params;
        const tasks = await Task.find({ userName }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.assignTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { assignedToText, assignedTo } = req.body;
        console.log(assignedToText, assignedTo);
        let resolvedUserName = assignedTo;

        if (assignedToText) {
            const normalized = assignedToText.trim().replace(/\./g, ' ');
            const parts = normalized.split(/\s+/);
            const firstName = parts[0] || '';
            const lastName = parts.slice(1).join(' ') || '';

            const user = await User.findOne({
                firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
                lastName: { $regex: new RegExp(`^${lastName}$`, 'i') }
            });

            if (!user) {
                return res.status(404).json({ message: `User "${assignedToText}" not found. Check the name in the transcript.` });
            }
            resolvedUserName = user.userName;
        }

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { assignedTo: resolvedUserName, isAssigned: true },
            { new: true }
        );

        res.json({ task: updatedTask, resolvedUserName });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


exports.completeTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { isCompleted: true },
            { new: true }
        );
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getCompletedTasks = async (req, res) => {
    try {
        const { username } = req.params;
        const tasks = await Task.find({ assignedTo: username, isCompleted: true }).sort({ updatedAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        await Task.findByIdAndDelete(taskId);
        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
