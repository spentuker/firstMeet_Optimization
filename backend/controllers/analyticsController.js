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

        // 2. Pending Count
        const pendingCount = allTasks.filter(t => !t.isCompleted).length;

        // 3. Priority Distribution
        const priorityDistribution = [
            { name: 'HIGH', value: allTasks.filter(t => t.priority === 'HIGH').length },
            { name: 'MEDIUM', value: allTasks.filter(t => t.priority === 'MEDIUM').length },
            { name: 'LOW', value: allTasks.filter(t => t.priority === 'LOW').length }
        ];

        // 4. Member Performance Matrix
        const memberMatrix = users.map(user => {
            const userTasks = allTasks.filter(t => t.assignedTo === user.userName);
            const completedCount = userTasks.filter(t => t.isCompleted).length;
            const pendingCount = userTasks.length - completedCount;

            return {
                name: user.userName,
                completed: completedCount,
                pending: pendingCount,
                ratio: userTasks.length > 0 ? Math.round((completedCount / userTasks.length) * 100) : 0,
            };
        }).sort((a, b) => b.ratio - a.ratio);

        // 5. Meeting Effectiveness
        const totalActionItems = allTasks.length;
        const resolutionRatio = totalActionItems > 0 ? (allTasks.filter(t => t.isCompleted).length / totalActionItems) : 0;
        const effectivenessScore = Math.round((resolutionRatio * 70) + (Math.min(totalMeetings, 100) * 0.3));

        // 6. Meeting frequency by week (last 8 weeks)
        const getWeekStart = (weeksAgo) => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - d.getDay() - weeksAgo * 7);
            return d;
        };
        const meetingsByWeek = Array.from({ length: 8 }, (_, i) => {
            const weeksAgo = 7 - i;
            const weekStart = getWeekStart(weeksAgo);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return {
                week: label,
                count: meetings.filter(m => {
                    const d = new Date(m.createdAt);
                    return d >= weekStart && d < weekEnd;
                }).length
            };
        });

        res.json({
            kpis: {
                totalMeetings,
                completionRate: calculateCompletionRate(allTasks),
                monthlyGrowth: 15,
                effectivenessScore,
                globalFocusScore: 82
            },
            charts: {
                lifecycle,
                pendingCount,
                priorityDistribution,
                memberMatrix,
                meetingsByWeek,
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

        // 4. Priority Distribution
        const priorityDistribution = [
            { name: 'HIGH', value: myTasks.filter(t => t.priority === 'HIGH').length },
            { name: 'MEDIUM', value: myTasks.filter(t => t.priority === 'MEDIUM').length },
            { name: 'LOW', value: myTasks.filter(t => t.priority === 'LOW').length }
        ];

        // 5. Pending Count
        const pendingCount = myTasks.filter(t => !t.isCompleted).length;

        res.json({
            kpis: {
                openTasks: myTasks.filter(t => !t.isCompleted).length,
                completedRatio: calculateCompletionRate(myTasks),
                streak: new Set(completedTasks.map(t => t.updatedAt.toISOString().split('T')[0])).size,
                personalImpact: Math.round((completedTasks.length * 10) + (myMeetings.length * 5)),
                meetingsAttended: myMeetings.length
            },
            charts: {
                productivityByDay,
                priorityDistribution,
                pendingCount,
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
