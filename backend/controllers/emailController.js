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

// ─── MEETING RECAP DATA ────────────────────────────────────────────────────────
// Fetches meeting + resolves assignee emails, returns pre-filled subject/body/recipients

exports.getMeetingRecapData = async (req, res) => {
    try {
        const Meeting = require('../models/meeting');
        const User    = require('../models/user');

        const meeting = await Meeting.findById(req.params.meetingId).lean();
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        // Collect all unique usernames from meeting
        const usernameSet = new Set([meeting.userName]);
        for (const item of meeting.actionItems || []) {
            if (item.assignedTo?.trim()) usernameSet.add(item.assignedTo.trim());
            if (item.assignedBy?.trim()) usernameSet.add(item.assignedBy.trim());
        }
        const usernames = [...usernameSet].filter(Boolean);

        // Look up User records
        const users   = await User.find({ userName: { $in: usernames } }).lean();
        const userMap = {};
        for (const u of users) userMap[u.userName] = u;

        // Build de-duped recipients (dedupe by email address)
        const seenEmails = new Set();
        const recipients = [];
        for (const uname of usernames) {
            const u   = userMap[uname];
            const key = u?.email || uname;
            if (seenEmails.has(key)) continue;
            seenEmails.add(key);
            recipients.push({
                userName:    uname,
                displayName: u ? `${u.firstName} ${u.lastName}` : uname,
                email:       u?.email || '',
                found:       !!u?.email,
            });
        }

        // Build subject and body
        const date = new Date(meeting.createdAt).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        });
        const subject = `Meeting Recap \u2014 ${meeting.title} \u00b7 ${date}`;

        const SEP = '\u2500'.repeat(44);
        const actionLines = (meeting.actionItems || []).map((item, i) => {
            let line = `${i + 1}. ${item.title || item.task || 'Action Item'}`;
            if (item.assignedTo) line += ` \u2014 Assigned to: ${item.assignedTo}`;
            if (item.priority)   line += ` [${item.priority}]`;
            if (item.deadline)   line += ` \u00b7 Due: ${item.deadline}`;
            return line;
        }).join('\n');

        const body =
            `Hi,\n\nHere\u2019s a recap of our recent meeting.\n\n` +
            `Meeting: ${meeting.title}\nDate: ${date}\n\n` +
            `${SEP}\nSUMMARY\n${SEP}\n${meeting.summary || 'No summary recorded.'}\n\n` +
            `${SEP}\nACTION ITEMS\n${SEP}\n${actionLines || 'No action items recorded.'}\n\n` +
            `${SEP}\nThis recap was generated by FirstMeet.`;

        res.json({ subject, body, recipients });
    } catch (err) {
        console.error('getMeetingRecapData error:', err);
        res.status(500).json({ message: 'Server error fetching recap data' });
    }
};
