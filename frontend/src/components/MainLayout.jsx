import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/homePage.css';

const MainLayout = ({ children, activeTab, setActiveTab }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const userName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole');
    const isEmployee = userRole === 'employee';

    const handleLogout = () => {
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        navigate('/signin');
    };

    const handleTabClick = (tab) => {
        if (location.pathname !== '/home') {
            navigate(`/home?tab=${tab}`);
        } else if (setActiveTab) {
            setActiveTab(tab);
        }
    };

    return (
        <div className="home-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">

                    <span className="sidebar-title">MeetUp</span>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${location.pathname === '/analytics' ? 'nav-active' : ''}`}
                        onClick={() => navigate('/analytics')}
                    >
                        <span>Analytics</span>
                    </button>
                    <button
                        className={`nav-item ${(location.pathname === '/home' && activeTab === 'tasks') ? 'nav-active' : ''}`}
                        onClick={() => handleTabClick('tasks')}
                    >

                        <span>Tasks</span>
                    </button>
                    <button
                        className={`nav-item ${(location.pathname === '/home' && activeTab === 'history') ? 'nav-active' : ''}`}
                        onClick={() => handleTabClick('history')}
                    >
                        <span>History</span>
                    </button>
                    <button
                        className={`nav-item ${location.pathname === '/completed' ? 'nav-active' : ''}`}
                        onClick={() => navigate('/completed')}
                    >

                        <span>Completed</span>
                    </button>
                    <button
                        className={`nav-item ${location.pathname === '/jira' ? 'nav-active' : ''}`}
                        onClick={() => navigate('/jira')}
                    >
                        <span>Jira</span>
                    </button>
                    <button
                        className={`nav-item ${location.pathname === '/email' ? 'nav-active' : ''}`}
                        onClick={() => navigate('/email')}
                    >
                        <span>Email</span>
                    </button>
                    {!isEmployee && (
                        <button
                            className={`nav-item nav-new-meeting ${location.pathname === '/meeting' ? 'nav-active' : ''}`}
                            onClick={() => navigate('/meeting')}
                        >
                            <span>New Meeting</span>
                        </button>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="user-avatar">{userName?.charAt(0).toUpperCase()}</div>
                        <span className="user-name">{userName}</span>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
