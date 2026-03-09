import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import MainLayout from '../components/MainLayout';
import { getGreeting } from '../utils/greetings';
import '../styles/dashboard.css';

// ─── Animated counter hook ───────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (target === undefined || target === null) return;
        const numTarget = parseFloat(String(target).replace(/[^0-9.]/g, '')) || 0;
        let start = null;
        const tick = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * numTarget));
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [target, duration]);
    return count;
}

// ─── Theme-aligned color palette ─────────────────────────────────────────────
const C = {
    blue:   '#0D99FF',
    green:  '#30D158',
    gold:   '#FF9F0A',
    rose:   '#FF453A',
    purple: '#BF5AF2',
    cyan:   '#5AC8FA',
};

// ─── Focus Ring SVG ──────────────────────────────────────────────────────────
const FocusRing = ({ score }) => {
    const radius = 52;
    const circ   = 2 * Math.PI * radius;
    const offset = circ - (Math.min(score, 100) / 100) * circ;
    const color  = score >= 70 ? C.green : score >= 40 ? C.gold : C.rose;
    return (
        <svg width="130" height="130" viewBox="0 0 130 130" style={{ display: 'block', margin: '0.5rem auto 0' }}>
            <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--border-color)" strokeWidth="9" />
            <circle cx="65" cy="65" r={radius} fill="none"
                stroke={color} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
            <text x="65" y="61" textAnchor="middle" fontSize="24" fontWeight="600" fill="var(--text-main)">{score}</text>
            <text x="65" y="77" textAnchor="middle" fontSize="9"  fontWeight="600" fill="var(--text-muted)" letterSpacing="0.08em">FOCUS %</text>
        </svg>
    );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, suffix = '', color, badge }) {
    const num = useCountUp(typeof value === 'number' ? value : 0);
    return (
        <div className="kpi-card" style={color ? { borderLeftColor: color } : {}}>
            <span className="kpi-label">{label}</span>
            <span className="kpi-value" style={color ? { color } : {}}>
                {num}
                {suffix && <sub style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.2rem' }}>{suffix}</sub>}
                {badge !== undefined && (
                    <span className="kpi-badge" style={{
                        color:       badge >= 0 ? C.green : C.rose,
                        background:  badge >= 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
                    }}>
                        {badge >= 0 ? '▲' : '▼'} {Math.abs(badge)}%
                    </span>
                )}
            </span>
        </div>
    );
}

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border-color)',
            padding: '0.75rem 1rem', borderRadius: '12px',
            boxShadow: 'var(--shadow-card)', fontFamily: "'Inter', sans-serif",
        }}>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{label}</p>
            {payload.map((entry, i) => (
                <p key={i} style={{ margin: '2px 0', fontWeight: 700, fontSize: '1rem', color: entry.color || 'var(--text-main)' }}>
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    );
};

const axisStyle = { fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600, fontFamily: 'Inter' };
const RANK_BADGES = ['🥇', '🥈', '🥉'];
const RANGES = [{ label: 'Last 7d', value: '7' }, { label: 'Last 30d', value: '30' }, { label: 'Last 90d', value: '90' }, { label: 'All time', value: 'all' }];

// ─── Wins Helpers ────────────────────────────────────────────────────────────
const computeTeamWins = (stats) => {
    const completedThisWeek = stats.charts.teamVelocity?.at(-1)?.completed ?? 0;
    const rate    = stats.kpis.completionRate ?? 0;
    const meetings = stats.kpis.totalMeetings ?? 0;
    const top     = stats.charts.memberMatrix?.[0];
    const wins = [
        {
            icon: '✅',
            value: completedThisWeek,
            label: 'Tasks Completed This Week',
            message: completedThisWeek > 10 ? 'Incredible output — crushing it! 🚀' : completedThisWeek > 0 ? 'Good momentum — keep going! 💪' : 'Every big sprint starts with one task.',
            color: '#30D158',
        },
        {
            icon: rate >= 70 ? '🔥' : rate >= 40 ? '📈' : '💪',
            value: `${rate}%`,
            label: 'Team Completion Rate',
            message: rate >= 70 ? 'Outstanding — team is firing on all cylinders!' : rate >= 40 ? 'Solid progress — almost there!' : 'Room to grow — keep pushing together!',
            color: rate >= 70 ? '#30D158' : rate >= 40 ? '#FF9F0A' : '#FF453A',
        },
        {
            icon: '📅',
            value: meetings,
            label: 'Total Meetings Held',
            message: meetings > 5 ? 'Great team collaboration happening!' : meetings > 0 ? 'Good cadence — keep meeting up!' : 'Schedule your first meeting!',
            color: '#0D99FF',
        },
    ];
    if (top && top.completed > 0) wins.push({
        icon: '🥇',
        value: `${top.ratio}%`,
        label: `MVP: ${top.name}`,
        message: `Completed ${top.completed} tasks — leading by example!`,
        color: '#FF9F0A',
    });
    return wins;
};

const computePersonalWins = (stats) => {
    const completedThisWeek = stats.kpis.completedThisWeek  ?? 0;
    const focusScore        = stats.kpis.personalFocusScore ?? 0;
    const streak            = stats.kpis.streak             ?? 0;
    const meetings          = stats.kpis.meetingsAttended   ?? 0;
    return [
        {
            icon: '✅',
            value: completedThisWeek,
            label: 'Tasks Completed This Week',
            message: completedThisWeek > 5 ? "You're on fire — amazing productivity! 🚀" : completedThisWeek > 0 ? 'Great start — keep the momentum! 💪' : 'Today is a great day to start!',
            color: '#30D158',
        },
        {
            icon: '🎯',
            value: `${focusScore}%`,
            label: 'Weekly Focus Score',
            message: focusScore >= 80 ? 'Laser-focused — exceptional work!' : focusScore >= 50 ? 'Solid focus this week!' : "Stay sharp — you've got this!",
            color: focusScore >= 70 ? '#30D158' : focusScore >= 40 ? '#FF9F0A' : '#FF453A',
        },
        {
            icon: '🔥',
            value: streak,
            label: 'Active Days',
            message: streak >= 5 ? 'Unstoppable consistency — wow!' : streak >= 3 ? 'Building great habits!' : 'Start your winning streak today!',
            color: streak >= 3 ? '#FF9F0A' : '#0D99FF',
        },
        {
            icon: '📅',
            value: meetings,
            label: 'Meetings Attended',
            message: meetings > 0 ? 'Well-engaged with your team!' : 'Connect with your team today!',
            color: '#BF5AF2',
        },
    ];
};

const StatsTicker = ({ stats, isTeam }) => {
    const wins = isTeam ? computeTeamWins(stats) : computePersonalWins(stats);
    const [idx, setIdx]       = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (wins.length <= 1) return;
        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setIdx(i => (i + 1) % wins.length);
                setVisible(true);
            }, 380);
        }, 3800);
        return () => clearInterval(interval);
    }, [wins.length]);

    if (!wins.length) return null;
    const w = wins[idx];
    return (
        <div className="stats-ticker">
            <span className="ticker-dot" style={{ background: w.color }} />
            <span className={`ticker-text${visible ? ' tk-show' : ''}`} style={{ color: w.color }}>
                {w.value}
            </span>
            <span className={`ticker-msg${visible ? ' tk-show' : ''}`}>
                {w.label}
                <span className="ticker-sub"> — {w.message}</span>
            </span>
            <div className="ticker-pips">
                {wins.map((_, i) => (
                    <button
                        key={i}
                        type="button"
                        className={`ticker-pip${i === idx ? ' active' : ''}`}
                        onClick={() => { setIdx(i); setVisible(true); }}
                    />
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const DashboardPage = () => {
    const [loading, setLoading]           = useState(true);
    const [stats,   setStats]             = useState(null);
    const [range,   setRange]             = useState('all');
    const [digest,  setDigest]            = useState('');
    const [digestLoading, setDigestLoading] = useState(false);
    const [viewMode, setViewMode]           = useState('team'); // 'team' | 'personal'

    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName') || 'there';
    const isAdmin  = userRole === 'admin';
    const [greeting] = useState(() => getGreeting(userName));

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setStats(null); // clear stale data so guards prevent rendering wrong-shape charts
        try {
            const usePersonal = !isAdmin || viewMode === 'personal';
            const endpoint = usePersonal
                ? `/api/analytics/employee?userName=${encodeURIComponent(userName)}&range=${range}`
                : `/api/analytics/admin?range=${range}`;
            const response = await api.get(endpoint);
            setStats(response.data);
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    }, [isAdmin, userName, range, viewMode]);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const fetchDigest = async () => {
        setDigestLoading(true);
        try {
            const res = await api.get('/api/analytics/digest');
            setDigest(res.data.digest);
        } catch {
            setDigest('Could not generate digest. Please try again.');
        } finally {
            setDigestLoading(false);
        }
    };

    if (loading) return <MainLayout><div className="loading-container">Loading your data...</div></MainLayout>;
    if (!stats)  return <MainLayout><div className="loading-container">Could not load stats. Please refresh.</div></MainLayout>;

    return (
        <MainLayout>
            <div className="dashboard-container">

                {/* ── Header + Range Control ── */}
                <header className="dashboard-header">
                    <div className="dashboard-header-row">
                        <div>
                            <h1>{greeting}</h1>
                            <p className="dashboard-subtitle">
                                {isAdmin && viewMode === 'team'
                                    ? '📊 Company-wide analytics at a glance'
                                    : '📈 Your personal performance snapshot'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {isAdmin && (
                                <div className="view-toggle">
                                    <button
                                        className={`view-toggle-btn${viewMode === 'team' ? ' active' : ''}`}
                                        onClick={() => { setViewMode('team'); setStats(null); }}
                                    >
                                        🏢 Team
                                    </button>
                                    <button
                                        className={`view-toggle-btn${viewMode === 'personal' ? ' active' : ''}`}
                                        onClick={() => { setViewMode('personal'); setStats(null); }}
                                    >
                                        👤 My View
                                    </button>
                                </div>
                            )}
                            <div className="range-control">
                                {RANGES.map(r => (
                                    <button key={r.value} className={`range-btn${range === r.value ? ' active' : ''}`} onClick={() => setRange(r.value)}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── AI Weekly Digest (Admin team view only) ── */}
                {isAdmin && viewMode === 'team' && (
                    <div className="digest-card">
                        <div className="digest-left">
                            <span className="digest-icon">🤖</span>
                            <div>
                                <div className="digest-label">AI Weekly Digest</div>
                                <p className="digest-text">
                                    {digest || 'Generate a Qwen-powered plain-English summary of this week\'s team performance.'}
                                </p>
                            </div>
                        </div>
                        <button className="digest-btn" onClick={fetchDigest} disabled={digestLoading}>
                            {digestLoading ? (
                                <><span className="digest-spinner" /> Generating…</>
                            ) : (
                                digest ? 'Regenerate' : 'Generate Digest'
                            )}
                        </button>
                    </div>
                )}

                {/* ── KPI Row ── */}
                <div className="kpi-row">
                    {isAdmin && viewMode === 'team' ? (
                        <>
                            <KpiCard label="Total Meetings"  value={stats.kpis.totalMeetings} />
                            <KpiCard label="Success Score"   value={stats.kpis.effectivenessScore} suffix="/100" color={C.blue} />
                            <KpiCard label="Team Balance"    value={stats.kpis.globalFocusScore}   suffix="%"    color={C.gold} />
                            <KpiCard label="Completion Rate" value={stats.kpis.completionRate}      suffix="%"    color={C.green} />
                            <KpiCard label="Monthly Growth"  value={Math.abs(stats.kpis.monthlyGrowth)} suffix="%" color={stats.kpis.monthlyGrowth >= 0 ? C.cyan : C.rose} badge={stats.kpis.monthlyGrowth} />
                        </>
                    ) : (
                        <>
                            <KpiCard label="Pending Tasks"   value={stats.kpis.openTasks} />
                            <KpiCard label="Day Streak"      value={stats.kpis.streak}           suffix=" days" color={C.gold} />
                            <KpiCard label="Completion Rate" value={stats.kpis.completedRatio}   suffix="%"     color={C.green} />
                            <KpiCard label="Points Earned"   value={stats.kpis.personalImpact}                  color={C.blue} />
                            <KpiCard label="Meetings"        value={stats.kpis.meetingsAttended || 0}            color={C.purple} />
                        </>
                    )}
                </div>

                {/* ── Stats Ticker ── */}
                <StatsTicker stats={stats} isTeam={isAdmin && viewMode === 'team'} />

                {/* ── Charts Grid ── */}
                <div className="dashboard-grid">
                    {isAdmin && viewMode === 'team' ? (
                        <>
                            {/* Tasks Activity */}
                            <div className="chart-card">
                                <h3>Tasks Activity</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={stats.charts.lifecycle || []}>
                                        <defs>
                                            <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={C.blue}  stopOpacity={0.15} />
                                                <stop offset="95%" stopColor={C.blue}  stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={C.green} stopOpacity={0.15} />
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

                            {/* Team Performance */}
                            <div className="chart-card">
                                <h3>Team Performance</h3>
                                <div className="matrix-table-container">
                                    <table className="matrix-table">
                                        <thead>
                                            <tr><th>#</th><th>MEMBER</th><th>YIELD</th><th>PENDING</th></tr>
                                        </thead>
                                        <tbody>
                                            {(stats.charts.memberMatrix || []).map((m, i) => (
                                                <tr key={i}>
                                                    <td style={{ color: 'var(--text-muted)', width: '2rem', fontSize: '1rem' }}>{RANK_BADGES[i] || `${i + 1}`}</td>
                                                    <td style={{ fontWeight: 700 }}>{m.name}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ flex: 1, height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', minWidth: '50px' }}>
                                                                <div style={{ width: `${m.ratio}%`, height: '100%', background: m.ratio >= 70 ? C.green : m.ratio >= 40 ? C.gold : C.rose, borderRadius: '2px', transition: 'width 1s ease' }} />
                                                            </div>
                                                            <div className="yield-pill" style={{ background: m.ratio >= 70 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)', color: m.ratio >= 70 ? C.green : C.rose }}>
                                                                {m.ratio}%
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{m.pending}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Priority Distribution */}
                            <div className="chart-card">
                                <h3>Priority Distribution</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={stats.charts.priorityDistribution || []} innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value">
                                            <Cell fill={C.rose} />
                                            <Cell fill={C.gold} />
                                            <Cell fill={C.green} />
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'Inter' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Team Velocity */}
                            <div className="chart-card">
                                <h3>Team Velocity</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={stats.charts.teamVelocity || []}>
                                        <defs>
                                            <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={C.purple} stopOpacity={0.15} />
                                                <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="week" tick={axisStyle} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" name="Completed" dataKey="completed" stroke={C.purple} strokeWidth={2.5} fill="url(#gv)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Stale Tasks */}
                            <div className="chart-card">
                                <h3>Stale Open Tasks</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={stats.charts.staleTaskBuckets || []} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="label" type="category" tick={axisStyle} tickLine={false} axisLine={false} width={72} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-subtle)' }} />
                                        <Bar dataKey="count" name="Tasks" radius={[0, 6, 6, 0]} barSize={28}>
                                            {(stats.charts.staleTaskBuckets || []).map((_, idx) => (
                                                <Cell key={idx} fill={[C.gold, C.rose, C.purple][idx]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Action Item Load */}
                            <div className="chart-card">
                                <h3>Action Item Load</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={stats.charts.actionItemAssignees || []} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 9 }} tickLine={false} axisLine={false} width={88} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-subtle)' }} />
                                        <Bar dataKey="assigned"  name="Assigned"  fill={C.blue}  radius={[0, 4, 4, 0]} barSize={9} />
                                        <Bar dataKey="completed" name="Completed" fill={C.green} radius={[0, 4, 4, 0]} barSize={9} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Urgent Tasks */}
                            <div className="chart-card full-width">
                                <h3>🔴 Urgent Tasks</h3>
                                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                    {(stats.charts.urgentTasks || []).length > 0
                                        ? (stats.charts.urgentTasks || []).map(task => (
                                            <div key={task._id} className="urgent-task-item">
                                                <div>
                                                    <div className="urgent-task-title">{task.title}</div>
                                                    <div className="urgent-task-meta">By {task.assignedTo || 'Unassigned'}</div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ color: C.rose, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.2rem' }}>CRITICAL</div>
                                                    <div className="urgent-task-meta">{task.deadline || 'OPEN'}</div>
                                                </div>
                                            </div>
                                        ))
                                        : <p style={{ color: 'var(--text-muted)' }}>No high-priority items on the agenda. 🎉</p>
                                    }
                                </div>
                            </div>

                            {/* Meeting Frequency */}
                            <div className="chart-card">
                                <h3>Meeting Frequency</h3>
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={stats.charts.meetingsByWeek || []}>
                                        <XAxis dataKey="week" tick={axisStyle} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-subtle)' }} />
                                        <Bar dataKey="count" fill={C.cyan} radius={[6, 6, 0, 0]} barSize={26} name="Meetings" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Jira vs Local */}
                            <div className="chart-card">
                                <h3>Jira vs Local Tasks</h3>
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie data={stats.charts.jiraVsLocal || []} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                                            <Cell fill={C.blue} />
                                            <Cell fill={C.purple} />
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'Inter' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Focus Ring */}
                            <div className="chart-card" style={{ alignItems: 'center' }}>
                                <h3>Weekly Focus Score</h3>
                                <FocusRing score={stats.kpis.personalFocusScore || 0} />
                                <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                                    {stats.kpis.completedThisWeek || 0} of {stats.kpis.assignedThisWeek || 0} tasks completed this week
                                </p>
                            </div>

                            {/* Work Skills Radar */}
                            <div className="chart-card">
                                <h3>Work Skills</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <RadarChart data={stats.charts.priorityMatrix || []}>
                                        <PolarGrid stroke="var(--border-color)" />
                                        <PolarAngleAxis dataKey="subject" tick={axisStyle} />
                                        <PolarRadiusAxis angle={30} domain={[0, 10]} hide />
                                        <Radar name="Performance" dataKey="A" stroke={C.blue} fill={C.blue} fillOpacity={0.25} />
                                        <Tooltip content={<CustomTooltip />} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Weekly Work */}
                            <div className="chart-card">
                                <h3>Weekly Work</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={stats.charts.productivityByDay || []}>
                                        <XAxis dataKey="day" tick={axisStyle} tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-subtle)' }} />
                                        <Bar dataKey="count" fill={C.green} radius={[6, 6, 0, 0]} barSize={36} name="Tasks" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Priority Mix */}
                            <div className="chart-card">
                                <h3>Priority Mix</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={stats.charts.priorityDistribution || []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                                            <Cell fill={C.rose} />
                                            <Cell fill={C.gold} />
                                            <Cell fill={C.green} />
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'Inter' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Upcoming Tasks */}
                            <div className="chart-card full-width">
                                <h3>📅 Upcoming Tasks</h3>
                                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                    {(stats.charts.upcomingDeadlines || []).length > 0
                                        ? (stats.charts.upcomingDeadlines || []).map(task => (
                                            <div key={task._id} className="urgent-task-item">
                                                <div>
                                                    <div className="urgent-task-title">{task.title}</div>
                                                    <div className="urgent-task-meta">Status: Active</div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ color: C.gold, fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.2rem' }}>DUE</div>
                                                    <div className="urgent-task-meta">{task.deadline}</div>
                                                </div>
                                            </div>
                                        ))
                                        : <p style={{ color: 'var(--text-muted)' }}>Your roadmap is clear. 🎉</p>
                                    }
                                </div>
                            </div>

                            {/* 7-Day Throughput */}
                            <div className="chart-card">
                                <h3>7-Day Throughput</h3>
                                <ResponsiveContainer width="100%" height={240}>
                                    <AreaChart data={stats.charts.throughput || []}>
                                        <defs>
                                            <linearGradient id="gtp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={C.purple} stopOpacity={0.18} />
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

                            {/* Meeting History */}
                            <div className="chart-card">
                                <h3>My Meetings</h3>
                                <div className="meeting-history-list">
                                    {(stats.charts.meetingsWithNotes || []).length > 0
                                        ? (stats.charts.meetingsWithNotes || []).slice(0, 6).map(m => (
                                            <div key={m._id} className="meeting-history-item" onClick={() => window.location.href = '/meeting'} role="button">
                                                <div>
                                                    <div className="urgent-task-title">{m.title}</div>
                                                    <div className="urgent-task-meta">{m.actionItemsCount} action items · {new Date(m.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                {m.hasNote && <span className="note-badge" title="Has your notes">📝</span>}
                                            </div>
                                        ))
                                        : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No meetings recorded yet.</p>
                                    }
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
