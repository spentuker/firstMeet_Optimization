const Task = require("../models/tasks");
const Meeting = require("../models/meeting");
const User = require("../models/user");

const calculateCompletionRate = (tasks) => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.isCompleted).length;
    return Math.round((completed / tasks.length) * 100);
};

const getRecentDays = (days) => {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toISOString().split('T')[0]);
    }
    return labels;
};

exports.getAdminStats = async (req, res) => {
    try {
        const totalMeetings = await Meeting.countDocuments();
        const allTasks = await Task.find();
        const meetings = await Meeting.find();
        const users = await User.find({ role: "employee" });

        // 1. Lifecycle: Created vs Resolved over last 14 days
        const recentDays = getRecentDays(14);
        const lifecycle = recentDays.map(date => {
            const created = allTasks.filter(t => t.createdAt.toISOString().split('T')[0] === date).length;
            const resolved = allTasks.filter(t => t.isCompleted && t.updatedAt.toISOString().split('T')[0] === date).length;
            return { date, created, resolved };
        });

        // 2. Refined Topic Distribution
        const topicMap = {
            Sprint: ["sprint", "agile", "standup", "velocity"],
            Client: ["client", "customer", "external", "vendor"],
            Design: ["design", "ui", "ux", "frontend", "mockup"],
            Backend: ["api", "database", "server", "backend", "node"],
            Bug: ["fix", "bug", "issue", "debug", "error"],
            Planning: ["roadmap", "planning", "strategy", "vision"]
        };
        const topicDistribution = Object.entries(topicMap).map(([name, keywords]) => ({
            name,
            value: meetings.filter(m => {
                const text = (m.title + (m.summary || "")).toLowerCase();
                return keywords.some(k => text.includes(k));
            }).length
        })).filter(t => t.value > 0);

        // 3. Sentiment Analysis
        const sentimentKeywords = {
            Positive: ["success", "solved", "fixed", "completed", "great", "launch", "done"],
            Risk: ["delay", "error", "blocker", "critical", "danger", "urgent", "failed"],
            Neutral: ["update", "discussion", "planning", "review", "sync", "meeting"]
        };
        const sentimentData = [
            { name: 'Positive', value: 0 },
            { name: 'Risk', value: 0 },
            { name: 'Neutral', value: 0 }
        ];
        meetings.forEach(m => {
            const text = ((m.summary || "") + m.title).toLowerCase();
            if (sentimentKeywords.Positive.some(k => text.includes(k))) sentimentData[0].value++;
            else if (sentimentKeywords.Risk.some(k => text.includes(k))) sentimentData[1].value++;
            else sentimentData[2].value++;
        });

        // 4. Member Performance Matrix
        const memberMatrix = users.map(user => {
            const userTasks = allTasks.filter(t => t.assignedTo === user.userName);
            const completedCount = userTasks.filter(t => t.isCompleted).length;
            const pendingCount = userTasks.length - completedCount;
            const completedWithTime = userTasks.filter(t => t.isCompleted && t.updatedAt > t.createdAt);
            const avgSpeed = completedWithTime.length > 0
                ? completedWithTime.reduce((acc, t) => acc + (t.updatedAt - t.createdAt), 0) / (1000 * 60 * 60 * completedWithTime.length)
                : 0;

            return {
                name: user.userName,
                completed: completedCount,
                pending: pendingCount,
                ratio: userTasks.length > 0 ? Math.round((completedCount / userTasks.length) * 100) : 0,
                speed: Math.round(avgSpeed)
            };
        }).sort((a, b) => b.ratio - a.ratio);

        // 5. Meeting Effectiveness
        const totalActionItems = allTasks.length;
        const resolutionRatio = totalActionItems > 0 ? (allTasks.filter(t => t.isCompleted).length / totalActionItems) : 0;
        const effectivenessScore = Math.round((resolutionRatio * 70) + (Math.min(totalMeetings, 100) * 0.3));

        res.json({
            kpis: {
                totalMeetings,
                completionRate: calculateCompletionRate(allTasks),
                monthlyGrowth: 15,
                avgResolutionHours: memberMatrix.length > 0 ? Math.round(memberMatrix.reduce((acc, m) => acc + m.speed, 0) / memberMatrix.length) : 0,
                effectivenessScore,
                globalFocusScore: 82
            },
            charts: {
                lifecycle,
                topicDistribution,
                sentimentData,
                memberMatrix,
                workloadBalance: memberMatrix.slice(0, 5).map(m => ({ name: m.name, pending: m.pending })),
                jiraVsLocal: [
                    { name: "Jira", value: allTasks.filter(t => t.jiraId).length },
                    { name: "Local", value: allTasks.filter(t => !t.jiraId).length }
                ],
                urgentTasks: allTasks.filter(t => !t.isCompleted && t.priority === "HIGH").slice(0, 5)
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching admin stats", error: error.message });
    }
};

exports.getEmployeeStats = async (req, res) => {
    try {
        const { userName } = req.query;
        if (!userName) return res.status(400).json({ message: "Username required" });

        const myTasks = await Task.find({ assignedTo: userName });
        const completedTasks = myTasks.filter(t => t.isCompleted);
        const myMeetings = await Meeting.find({ userName });

        // 1. Productivity by Day
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const productivityByDay = days.map((day, index) => ({
            day,
            count: completedTasks.filter(t => new Date(t.updatedAt).getDay() === index).length
        }));

        // 2. Efficiency Radar
        const priorityMatrix = [
            { subject: 'High Impact', A: myTasks.filter(t => t.priority === "HIGH").length, fullMark: 10 },
            { subject: 'Consistency', A: new Set(completedTasks.map(t => t.updatedAt.toISOString().split('T')[0])).size, fullMark: 10 },
            { subject: 'Speed', A: myTasks.length > 0 ? Math.round(calculateCompletionRate(myTasks) / 10) : 0, fullMark: 10 },
            { subject: 'Volume', A: completedTasks.length, fullMark: 10 },
            { subject: 'Involvement', A: myMeetings.length, fullMark: 10 }
        ];

        // 3. Throughput
        const recentDates = getRecentDays(7);
        const throughput = recentDates.map(date => ({
            date: date.split('-').slice(1).join('/'),
            count: completedTasks.filter(t => t.updatedAt.toISOString().split('T')[0] === date).length
        }));

        res.json({
            kpis: {
                openTasks: myTasks.filter(t => !t.isCompleted).length,
                completedRatio: calculateCompletionRate(myTasks),
                streak: new Set(completedTasks.map(t => t.updatedAt.toISOString().split('T')[0])).size,
                personalImpact: Math.round((completedTasks.length * 10) + (myMeetings.length * 5))
            },
            charts: {
                productivityByDay,
                priorityMatrix,
                throughput,
                experienceScore: (completedTasks.length * 100) + (myTasks.length * 10),
                upcomingDeadlines: myTasks.filter(t => !t.isCompleted && t.deadline).slice(0, 5)
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching employee stats", error: error.message });
    }
};
