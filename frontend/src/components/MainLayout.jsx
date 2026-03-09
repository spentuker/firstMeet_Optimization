import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/homePage.css';
import { useTheme } from '../context/ThemeContext';

/* ─── Heroicons outline SVGs (inline, 18×18) ─── */
const Icons = {
    analytics: (
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    ),
    tasks: (
        <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><path d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.591 21 9c0-1.058-.13-2.082-.382-3.016z"/></svg>
    ),
    history: (
        <svg viewBox="0 0 24 24"><path d="M12 8v4l3 3"/><path d="M3.051 9A9 9 0 1021 12H3"/><path d="M3 5v4h4"/></svg>
    ),
    completed: (
        <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    ),
    jira: (
        <svg viewBox="0 0 24 24"><path d="M15 5H9a4 4 0 000 8h1v3a4 4 0 004 4h1V14h-1a4 4 0 000-8h-1V3a4 4 0 00-4-4"/><path d="M7 5h10M7 19h10"/></svg>
    ),
    email: (
        <svg viewBox="0 0 24 24"><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
    ),
    newMeeting: (
        <svg viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15"/></svg>
    ),
    logout: (
        <svg viewBox="0 0 24 24"><path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>
    ),
};

const NAV_ITEMS = [
    { label: 'Analytics',  path: '/analytics',  icon: Icons.analytics },
    { label: 'Tasks',      path: '/home',        icon: Icons.tasks,     tab: 'tasks' },
    { label: 'History',    path: '/home',        icon: Icons.history,   tab: 'history' },
    { label: 'Completed',  path: '/completed',   icon: Icons.completed },
    { label: 'Jira',       path: '/jira',        icon: Icons.jira },
    { label: 'Email',      path: '/email',       icon: Icons.email },
];

// ─── About Modal ──────────────────────────────────────────────────────────────────────────────
const ABOUT_FEATURES = [
    { title: '🤖 AI Meeting Minutes',        color: '#0D99FF', items: ['Upload TXT/DOCX transcripts → AI summary in seconds', 'Speaker attribution, key decisions extracted', 'Action items with HIGH / MEDIUM / LOW priority scoring'] },
    { title: '🎤 Live Meeting Recorder',     color: '#30D158', items: ['Real-time speech-to-text during live meetings', 'Full transcript captured and auto-analyzed on demand', 'Retry-resilient: auto-reconnects on network blips'] },
    { title: '✅ Smart Task Management',     color: '#FF9F0A', items: ['Tasks auto-created from meeting action items', 'Assign to members with deadlines & priority', 'Full lifecycle: Pending → Assigned → Completed'] },
    { title: '📊 Analytics Dashboard',       color: '#BF5AF2', items: ['Personal: focus score, productivity heatmap, streak', 'Admin team view: performance matrix, velocity charts', 'KPIs: completion rate, monthly growth, effectiveness'] },
    { title: '💬 FirstMeet AI Chat',         color: '#5AC8FA', items: ['Persistent AI assistant across all pages (never resets)', 'Meeting Q&A — ask targeted questions per meeting', 'Document Q&A — upload a file and chat with it', 'AI weekly digest for admins'] },
    { title: '🔗 Integrations',              color: '#FF453A', items: ['Jira — sync action items to your Jira board', 'Email — send meeting summaries & tasks directly'] },
    { title: '📝 Notes & Collaboration',    color: '#32ADE6', items: ['Personal Markdown-enabled notes per meeting', 'Auto-save with 800 ms debounce'] },
    { title: '🎨 Design & UX',              color: '#64D2FF', items: ['Dark / Light theme with manual toggle', 'Animated page transitions & responsive layout', 'Chat history persisted in MongoDB across sessions'] },
];

const TECH_STACK = ['React 18', 'Vite', 'Node.js', 'Express', 'MongoDB Atlas', 'Mongoose', 'HuggingFace Qwen-72B', 'Web Speech API', 'Recharts', 'Jira REST API', 'EmailJS', 'Mammoth.js', 'React Router v6'];

const AboutModal = ({ onClose }) => createPortal(
    <div className="about-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="about-modal">
            {/* Minimal Header */}
            <div className="about-hero">
                <div className="about-hero-inner">
                    <div className="about-hero-logo">M</div>
                    <div>
                        <h2>FirstMeet</h2>
                        <p>An end-to-end intelligent meeting management platform. Upload transcripts or record live
                        meetings, get AI-generated summaries &amp; action items, manage tasks, visualize team
                        performance, and chat with your meeting data — all in one product.</p>
                    </div>
                </div>
                <button type="button" className="about-close" onClick={onClose}>✕</button>
            </div>

            {/* Feature Cards */}
            <div className="about-body">
                <div className="about-features-grid">
                    {ABOUT_FEATURES.map((f, i) => (
                        <div key={i} className="about-feature-card" style={{ '--fc-color': f.color }}>
                            <h4>{f.title}</h4>
                            <ul>{f.items.map((item, j) => <li key={j}>{item}</li>)}</ul>
                        </div>
                    ))}
                </div>

                {/* Tech Stack */}
                <div className="about-tech-section">
                    <div className="about-tech-label">Tech Stack</div>
                    <div className="about-tech-pills">
                        {TECH_STACK.map((t, i) => <span key={i} className="about-tech-pill">{t}</span>)}
                    </div>
                </div>
            </div>
        </div>
    </div>,
    document.body
);

const MainLayout = ({ children, activeTab, setActiveTab }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const userName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole');
    const isEmployee = userRole === 'employee';
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const [showAbout, setShowAbout] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        navigate('/signin');
    };

    const handleTabClick = (item) => {
        if (item.tab) {
            if (location.pathname !== '/home') {
                navigate(`/home?tab=${item.tab}`);
            } else if (setActiveTab) {
                setActiveTab(item.tab);
            }
        } else {
            navigate(item.path);
        }
    };

    const isActive = (item) => {
        if (item.tab) {
            return location.pathname === '/home' && activeTab === item.tab;
        }
        return location.pathname === item.path;
    };

    return (
        <>
        <div className="home-layout">
            <aside className="sidebar">
                {/* Brand */}
                <div className="sidebar-brand">
                    <div className="sidebar-logo-mark">M</div>
                    <span className="sidebar-title">MeetUp</span>
                    <button
                        type="button"
                        className="sidebar-info-btn"
                        onClick={() => setShowAbout(true)}
                        title="About FirstMeet"
                    >
                        i
                    </button>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <span className="sidebar-section-label">Menu</span>
                    {NAV_ITEMS.map((item, i) => (
                        <button
                            key={i}
                            className={`nav-item ${isActive(item) ? 'nav-active' : ''}`}
                            onClick={() => handleTabClick(item)}
                            style={{ animationDelay: `${i * 0.04}s` }}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}

                    {!isEmployee && (
                        <>
                            <span className="sidebar-section-label" style={{ marginTop: '1rem' }}>Actions</span>
                            <button
                                className={`nav-item nav-new-meeting ${location.pathname === '/meeting' ? 'nav-active' : ''}`}
                                onClick={() => navigate('/meeting')}
                            >
                                <span className="nav-icon">{Icons.newMeeting}</span>
                                <span>New Meeting</span>
                            </button>
                        </>
                    )}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    {/* Theme Toggle */}
                    <button className="nav-item sidebar-theme-toggle" onClick={toggleTheme}>
                        <span className="nav-icon">
                            {isDark
                                ? <svg viewBox="0 0 24 24"><path d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.728 12.728.707.707M1 12h1m18 0h1M4.22 19.78l.707-.707M18.364 5.636l.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                                : <svg viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                            }
                        </span>
                        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                        <div className="stt-track">
                            <div className="stt-thumb" />
                        </div>
                    </button>

                    <div className="sidebar-user">
                        <div className="user-avatar">{userName?.charAt(0).toUpperCase()}</div>
                        <span className="user-name">{userName}</span>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <span className="nav-icon">{Icons.logout}</span>
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        </>
    );
};

export default MainLayout;

