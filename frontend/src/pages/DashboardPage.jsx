import { useState, useEffect } from 'react';
import api from '../api';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import MainLayout from '../components/MainLayout';
import '../styles/dashboard.css';

const THEME = {
    gold: '#b45309',
    sage: '#15803d',
    blue: '#2563eb',
    slate: '#475569',
    white: '#ffffff',
    danger: '#be123c',
    chartBlue: '#3b82f6',
    chartGold: '#f59e0b',
    chartSage: '#10b981',
    chartPurple: '#8b5cf6',
    chartRose: '#f43f5e'
};

const DashboardPage = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName');
    const isAdmin = userRole === 'admin';

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
        if (active && payload && payload.length) {
            return (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 1000 }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: THEME.slate, textTransform: 'uppercase' }}>{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ margin: '4px 0 0', fontWeight: 800, fontSize: '1.25rem', color: entry.color || '#1e293b' }}>
                            {`${entry.name}: ${entry.value}`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <MainLayout>
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <h1>{isAdmin ? 'Company Overview' : 'Your Performance'}</h1>
                    <p style={{ fontSize: '1.1rem', color: THEME.slate, fontWeight: 500 }}>Comprehensive Insights for {userName}</p>
                </header>

                {/* KPI Metrics */}
                <div className="kpi-row">
                    {isAdmin ? (
                        <>
                            <div className="kpi-card">
                                <span className="kpi-label">Total Meetings</span>
                                <span className="kpi-value">{stats.kpis.totalMeetings}</span>
                            </div>
                            <div className="kpi-card">
                                <span className="kpi-label">Success Score</span>
                                <span className="kpi-value" style={{ color: THEME.blue }}>{stats.kpis.effectivenessScore}<sub style={{ fontSize: '1rem' }}>/100</sub></span>
                            </div>
                            <div className="kpi-card">
                                <span className="kpi-label">Team Balance</span>
                                <span className="kpi-value" style={{ color: THEME.gold }}>{stats.kpis.globalFocusScore}%</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="kpi-card">
                                <span className="kpi-label">Pending Tasks</span>
                                <span className="kpi-value">{stats.kpis.openTasks}</span>
                            </div>
                            <div className="kpi-card">
                                <span className="kpi-label">Day Streak</span>
                                <span className="kpi-value" style={{ color: THEME.gold }}>{stats.kpis.streak} <sub style={{ fontSize: '1.5rem', bottom: 0 }}>DAYS</sub></span>
                            </div>
                            <div className="kpi-card">
                                <span className="kpi-label">Completion Rate</span>
                                <span className="kpi-value" style={{ color: THEME.sage }}>{stats.kpis.completedRatio}%</span>
                            </div>
                            <div className="kpi-card">
                                <span className="kpi-label">Points Earned</span>
                                <span className="kpi-value" style={{ color: THEME.blue }}>{stats.kpis.personalImpact}</span>
                            </div>
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
                                            <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME.chartBlue} stopOpacity={0.1} />
                                                <stop offset="95%" stopColor={THEME.chartBlue} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME.chartSage} stopOpacity={0.1} />
                                                <stop offset="95%" stopColor={THEME.chartSage} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" name="Created" dataKey="created" stroke={THEME.chartBlue} strokeWidth={3} fillOpacity={1} fill="url(#colorCreated)" />
                                        <Area type="monotone" name="Resolved" dataKey="resolved" stroke={THEME.chartSage} strokeWidth={3} fillOpacity={1} fill="url(#colorResolved)" />
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
                                                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                                                    <td>
                                                        <div className="yield-pill" style={{ background: m.ratio > 70 ? '#f0fdf4' : '#fef2f2', color: m.ratio > 70 ? '#166534' : '#991b1b' }}>
                                                            {m.ratio}%
                                                        </div>
                                                    </td>
                                                    <td style={{ color: THEME.slate }}>{m.pending}</td>
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
                                        <Pie
                                            data={stats.charts.priorityDistribution}
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            <Cell fill={THEME.chartRose} />
                                            <Cell fill={THEME.chartGold} />
                                            <Cell fill={THEME.chartSage} />
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card full-width">
                                <h3>Urgent Tasks</h3>
                                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                    {stats.charts.urgentTasks.length > 0 ? stats.charts.urgentTasks.map(task => (
                                        <div key={task._id} className="urgent-task-item">
                                            <div>
                                                <div className="urgent-task-title">{task.title}</div>
                                                <div className="urgent-task-meta">Led by {task.assignedTo || 'Unassigned'}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: THEME.danger, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em' }}>CRITICAL</div>
                                                <div className="urgent-task-meta">{task.deadline || 'OPEN'}</div>
                                            </div>
                                        </div>
                                    )) : <p style={{ color: THEME.slate }}>No high-priority items on the agenda.</p>}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="chart-card">
                                <h3>Work Skills</h3>
                                <ResponsiveContainer width="100%" height={350}>
                                    <RadarChart data={stats.charts.priorityMatrix}>
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: THEME.slate, fontWeight: 600 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 10]} hide />
                                        <Radar name="Performance" dataKey="A" stroke={THEME.blue} fill={THEME.blue} fillOpacity={0.4} />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card">
                                <h3>Weekly Work</h3>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={stats.charts.productivityByDay}>
                                        <XAxis dataKey="day" stroke={THEME.slate} fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip cursor={{ fill: '#f1f5f9' }} />
                                        <Bar dataKey="count" fill={THEME.chartSage} radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>


                            <div className="chart-card">
                                <h3>Priority Distribution</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={stats.charts.priorityDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell fill={THEME.chartRose} />
                                            <Cell fill={THEME.chartGold} />
                                            <Cell fill={THEME.chartSage} />
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-card full-width">
                                <h3>Upcoming Tasks</h3>
                                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                    {stats.charts.upcomingDeadlines.length > 0 ? stats.charts.upcomingDeadlines.map(task => (
                                        <div key={task._id} className="urgent-task-item">
                                            <div>
                                                <div className="urgent-task-title">{task.title}</div>
                                                <div className="urgent-task-meta">Status: Active</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: THEME.gold, fontSize: '0.75rem', fontWeight: 800 }}>DUE</div>
                                                <div className="urgent-task-meta">{task.deadline}</div>
                                            </div>
                                        </div>
                                    )) : <p style={{ color: THEME.slate }}>Your roadmap is clear.</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default DashboardPage;
