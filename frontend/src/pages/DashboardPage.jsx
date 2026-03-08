import { useState, useEffect, useRef } from 'react';
import api from '../api';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import MainLayout from '../components/MainLayout';
import GoogleCalendarWidget from '../components/GoogleCalendarWidget';
import '../styles/dashboard.css';

// Animated counter hook
function useCountUp(target, duration = 1200) {
    const [count, setCount] = useState(0);
    const frameRef = useRef(null);
    useEffect(() => {
        if (target === undefined || target === null) return;
        const numTarget = parseFloat(String(target).replace(/[^0-9.]/g, '')) || 0;
        const start = performance.now();
        const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setCount(Math.round(eased * numTarget));
            if (progress < 1) frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameRef.current);
    }, [target, duration]);
    return count;
}

const GREETINGS = {
    morning: [
        (n) => `Good morning, ${n}! ☀️ Let's make today count.`,
        (n) => `Rise and shine, ${n}! 🌅 Big things are ahead today.`,
        (n) => `Morning, ${n}! 💪 Ready to crush it?`,
    ],
    afternoon: [
        (n) => `Good afternoon, ${n}! 🚀 Keep that momentum going.`,
        (n) => `Hey ${n}! 🎯 Halfway through — finish strong.`,
        (n) => `Afternoon, ${n}! ⚡ The grind is paying off.`,
    ],
    evening: [
        (n) => `Good evening, ${n}! 🌙 Wrapping up strong?`,
        (n) => `Evening, ${n}! 🌆 Another great day in the books.`,
        (n) => `Hey ${n}! 🦉 Night owls get things done too.`,
    ],
    night: [
        (n) => `Still at it, ${n}? 🌌 Dedication: maximum.`,
        (n) => `Late-night grind, ${n}! 💡 The world's asleep — you're not.`,
        (n) => `Burning midnight oil, ${n}! 🔥 Respect.`,
    ],
};

const getGreeting = (name) => {
    const h = new Date().getHours();
    const pool =
        h >= 5  && h < 12 ? GREETINGS.morning :
        h >= 12 && h < 18 ? GREETINGS.afternoon :
        h >= 18 && h < 22 ? GREETINGS.evening  : GREETINGS.night;
    return pool[Math.floor(Math.random() * pool.length)](name || 'there');
};

const C = {
    blue:   '#3b82f6',
    purple: '#8b5cf6',
    green:  '#10b981',
    gold:   '#f59e0b',
    rose:   '#f43f5e',
    cyan:   '#06b6d4',
};

function KpiCard({ label, value, suffix = '', color }) {
    const num = useCountUp(value);
    return (
        <div className="kpi-card">
            <span className="kpi-label">{label}</span>
            <span className="kpi-value" style={color ? { color } : {}}>
                {num}
                {suffix && (
                    <sub style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.2rem' }}>
                        {suffix}
                    </sub>
                )}
            </span>
        </div>
    );
}


const DashboardPage = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName');
    const isAdmin = userRole === 'admin';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const greeting = useRef(getGreeting(userName)).current;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const endpoint = isAdmin ? '/api/analytics/admin' : `/api/analytics/employee?userName=${userName}`;
                const response = await api.get(endpoint);
                setStats(response.data);
            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [isAdmin, userName]);

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">Loading your data...</div>
            </MainLayout>
        );
    }

    if (!stats) {
        return (
            <MainLayout>
                <div className="loading-container">Could not load stats. Please refresh.</div>
            </MainLayout>
        );
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        return (
            <div style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-card)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ margin: '2px 0', fontWeight: 800, fontSize: '1.05rem', color: entry.color || 'var(--text-main)' }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    };

    const axisStyle = { fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 };

    return (
        <MainLayout>
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <h1>{greeting}</h1>
                    <p className="dashboard-subtitle">
                        {isAdmin ? '📊 Company-wide analytics at a glance' : '📈 Your personal performance snapshot'}
                    </p>
                </header>

                {/* KPI Metrics */}
                <div className="kpi-row">
                    {isAdmin ? (
                        <>
                            <KpiCard label="Total Meetings"  value={stats.kpis.totalMeetings} />
                            <KpiCard label="Success Score"   value={stats.kpis.effectivenessScore} suffix="/100" color={C.blue} />
                            <KpiCard label="Team Balance"    value={stats.kpis.globalFocusScore}   suffix="%"    color={C.gold} />
                            <KpiCard label="Completion Rate" value={stats.kpis.completionRate}     suffix="%"    color={C.green} />
                        </>
                    ) : (
                        <>
                            <KpiCard label="Pending Tasks"   value={stats.kpis.openTasks} />
                            <KpiCard label="Day Streak"      value={stats.kpis.streak}         suffix=" days" color={C.gold} />
                            <KpiCard label="Completion Rate" value={stats.kpis.completedRatio} suffix="%"     color={C.green} />
                            <KpiCard label="Points Earned"   value={stats.kpis.personalImpact}               color={C.blue} />
                            <KpiCard label="Meetings Led"    value={stats.kpis.meetingsAttended || 0}         color={C.purple} />
                        </>
                    )}
                </div>

                {/* Analytical Visuals Grid */}
                <div className="dashboard-grid">
                    {isAdmin ? (
                        <>
                            <div className="chart-card">
                                <h3>Tasks Activity</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={stats.charts.lifecycle}>
                                        <defs>
                                            <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={C.blue}  stopOpacity={0.18} />
                                                <stop offset="95%" stopColor={C.blue}  stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={C.green} stopOpacity={0.18} />
                                                <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" name="Created"  dataKey="created"  stroke={C.blue}  strokeWidth={2.5} fill="url(#gc)" />
                                        <Area type="monotone" name="Resolved" dataKey="resolved" stroke={C.green} strokeWidth={2.5} fill="url(#gr)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card">
                                <h3>Team Performance</h3>
                                <div className="matrix-table-container">
                                    <table className="matrix-table">
                                        <thead>
                                            <tr>
                                                <th>MEMBER</th>
                                                <th>YIELD</th>
                                                <th>PENDING</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.charts.memberMatrix.map((m, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 700 }}>{m.name}</td>
                                                    <td>
                                                        <div className="yield-pill" style={{
                                                            background: m.ratio > 70 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                            color: m.ratio > 70 ? C.green : C.rose
                                                        }}>
                                                            {m.ratio}%
                                                        </div>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)' }}>{m.pending}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="chart-card">
                                <h3>Priority Distribution</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie data={stats.charts.priorityDistribution} innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value">
                                            <Cell fill={C.rose} />
                                            <Cell fill={C.gold} />
                                            <Cell fill={C.green} />
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card full-width">
                                <h3>🔴 Urgent Tasks</h3>
                                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                    {stats.charts.urgentTasks.length > 0
                                        ? stats.charts.urgentTasks.map(task => (
                                            <div key={task._id} className="urgent-task-item">
                                                <div>
                                                    <div className="urgent-task-title">{task.title}</div>
                                                    <div className="urgent-task-meta">By {task.assignedTo || 'Unassigned'}</div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ color: C.rose, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '0.2rem' }}>CRITICAL</div>
                                                    <div className="urgent-task-meta">{task.deadline || 'OPEN'}</div>
                                                </div>
                                            </div>
                                        ))
                                        : <p style={{ color: 'var(--text-muted)' }}>No high-priority items on the agenda.</p>
                                    }
                                </div>
                            </div>

                            <div className="chart-card">
                                <h3>📆 Meeting Frequency</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={stats.charts.meetingsByWeek || []}>
                                        <XAxis dataKey="week" tick={axisStyle} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-subtle)' }} />
                                        <Bar dataKey="count" fill={C.purple} radius={[6, 6, 0, 0]} barSize={26} name="Meetings" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card">
                                <h3>🔗 Jira vs Local Tasks</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={stats.charts.jiraVsLocal || []} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                                            <Cell fill={C.blue} />
                                            <Cell fill={C.purple} />
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <GoogleCalendarWidget />
                        </>
                    ) : (
                        <>
                            <div className="chart-card">
                                <h3>Work Skills</h3>
                                <ResponsiveContainer width="100%" height={320}>
                                    <RadarChart data={stats.charts.priorityMatrix}>
                                        <PolarGrid stroke="var(--border-color)" />
                                        <PolarAngleAxis dataKey="subject" tick={axisStyle} />
                                        <PolarRadiusAxis angle={30} domain={[0, 10]} hide />
                                        <Radar name="Performance" dataKey="A" stroke={C.blue} fill={C.blue} fillOpacity={0.3} />
                                        <Tooltip content={<CustomTooltip />} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card">
                                <h3>Weekly Work</h3>
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={stats.charts.productivityByDay}>
                                        <XAxis dataKey="day" tick={axisStyle} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-subtle)' }} />
                                        <Bar dataKey="count" fill={C.green} radius={[6, 6, 0, 0]} barSize={36} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card">
                                <h3>Priority Mix</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={stats.charts.priorityDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                                            <Cell fill={C.rose} />
                                            <Cell fill={C.gold} />
                                            <Cell fill={C.green} />
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card full-width">
                                <h3>📅 Upcoming Tasks</h3>
                                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                    {stats.charts.upcomingDeadlines.length > 0
                                        ? stats.charts.upcomingDeadlines.map(task => (
                                            <div key={task._id} className="urgent-task-item">
                                                <div>
                                                    <div className="urgent-task-title">{task.title}</div>
                                                    <div className="urgent-task-meta">Status: Active</div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ color: C.gold, fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.2rem' }}>DUE</div>
                                                    <div className="urgent-task-meta">{task.deadline}</div>
                                                </div>
                                            </div>
                                        ))
                                        : <p style={{ color: 'var(--text-muted)' }}>Your roadmap is clear. 🎉</p>
                                    }
                                </div>
                            </div>

                            <div className="chart-card">
                                <h3>📈 7-Day Throughput</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={stats.charts.throughput || []}>
                                        <defs>
                                            <linearGradient id="gtp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={C.purple} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" name="Completed" dataKey="count" stroke={C.purple} strokeWidth={2.5} fill="url(#gtp)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <GoogleCalendarWidget />
                        </>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default DashboardPage;
