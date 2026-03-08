const Task = require('../models/tasks');
const { InferenceClient } = require('@huggingface/inference');
const nodemailer = require('nodemailer');

const client = new InferenceClient(process.env.HF_API_KEY);

exports.draftEmail = async (req, res) => {
    try {
        const { taskId, description, recipient } = req.body;
        if (!taskId || !description) {
            return res.status(400).json({ message: 'taskId and description required' });
        }
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const recipientName = recipient || 'the recipient';

        const prompt = `You are a helpful assistant. Draft a professional, concise email to ${recipientName} about the task titled "${task.title}". Include the following notes that the user has provided as context: ${description}. Keep it short and to the point. Do not include subject line, just the body.`;

        const response = await client.chatCompletion({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: [
                { role: 'system', content: 'You are an AI assistant that drafts concise professional emails based on user inputs.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 1000,
        });

        const draft = response.choices[0].message.content;
        res.json({ draft });
    } catch (err) {
        console.error('draftEmail error', err);
        res.status(500).json({ message: 'Server error drafting email' });
    }
};


exports.sendEmail = async (req, res) => {
    try {
        const { to_email, cc_email, subject, message } = req.body;
        if (!to_email || !subject || !message) {
            return res.status(400).json({ message: 'Missing required email fields' });
        }
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.email_mail,
                pass: process.env.email_passkey,
            },
        });
        const mailOptions = {
            from: process.env.email_mail,
            to: to_email,
            cc: cc_email,
            subject,
            text: message,
        };
        const info = await transporter.sendMail(mailOptions);
        res.json({ message: 'Email sent successfully', info });
    } catch (error) {
        console.error('sendEmail error', error);
        res.status(500).json({ message: 'Server error sending email' });
    }
};
