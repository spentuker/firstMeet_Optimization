import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import MainLayout from '../components/MainLayout';
import '../styles/homePage.css';

const HomePage = () => {
    const [activeTab, setActiveTab] = useState('tasks');
    const [assignedTasks, setAssignedTasks] = useState([]);
    const [unassignedTasks, setUnassignedTasks] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [expandedMeeting, setExpandedMeeting] = useState(null);

    const [assignedPage, setAssignedPage] = useState(1);
    const [unassignedPage, setUnassignedPage] = useState(1);
    const tasksPerPage = 10;

    const navigate = useNavigate();
    const location = useLocation();
    const userRole = localStorage.getItem('userRole');
    const isEmployee = userRole === 'employee';

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tab = queryParams.get('tab');
        if (tab && (tab === 'tasks' || tab === 'history')) {
            setActiveTab(tab);
        }
    }, [location.search]);

    useEffect(() => {
        const fetchAll = async () => {
            const userName = localStorage.getItem('userName');
            if (!userName) {
                navigate('/signin');
                return;
            }
            try {
                const [assignedRes, unassignedRes, meetingsRes] = await Promise.all([
                    axios.get(`/api/tasks/assigned/${userName}`),
                    axios.get(`/api/tasks/unassigned?userName=${userName}`),
                    axios.get(`/api/meetings/${userName}`),
                ]);
                setAssignedTasks(assignedRes.data);
                setUnassignedTasks(unassignedRes.data);
                setMeetings(meetingsRes.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchAll();
    }, [navigate]);


    useEffect(() => {
        const total = Math.ceil(assignedTasks.length / tasksPerPage) || 1;
        if (assignedPage > total) setAssignedPage(total);
    }, [assignedTasks, assignedPage]);

    useEffect(() => {
        const total = Math.ceil(unassignedTasks.length / tasksPerPage) || 1;
        if (unassignedPage > total) setUnassignedPage(total);
    }, [unassignedTasks, unassignedPage]);

    const handleAssignToMe = async (taskId) => {
        const userName = localStorage.getItem('userName');
        try {
            await axios.patch(`/api/tasks/assign/${taskId}`, { assignedTo: userName });
            const [assignedRes, unassignedRes] = await Promise.all([
                axios.get(`/api/tasks/assigned/${userName}`),
                axios.get(`/api/tasks/unassigned?userName=${userName}`),
            ]);
            setAssignedTasks(assignedRes.data);
            setUnassignedTasks(unassignedRes.data);
        } catch (error) {
            console.error("Error assigning task to self:", error);
        }
    };

    const handleCompleteTask = async (taskId) => {
        const userName = localStorage.getItem('userName');
        try {
            await axios.patch(`/api/tasks/complete/${taskId}`);
            const assignedRes = await axios.get(`/api/tasks/assigned/${userName}`);
            setAssignedTasks(assignedRes.data);
        } catch (error) {
            console.error("Error completing task:", error);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) {
            return;
        }
        const userName = localStorage.getItem('userName');
        try {
            await axios.delete(`/api/tasks/${taskId}`);
            const unassignedRes = await axios.get(`/api/tasks/unassigned?userName=${userName}`);
            setUnassignedTasks(unassignedRes.data);
        } catch (error) {
            console.error("Error deleting task:", error);
            alert('Failed to delete task');
        }
    };

    const handleAssignFromHome = async (task) => {
        const userName = localStorage.getItem('userName');
        if (!task.assignedTo) {
            alert("No assignee name found on this task. Use 'Take Task' to assign it to yourself.");
            return;
        }
        try {
            await axios.patch(`/api/tasks/assign/${task._id}`, {
                assignedToText: task.assignedTo,
            });
            const [assignedRes, unassignedRes] = await Promise.all([
                axios.get(`/api/tasks/assigned/${userName}`),
                axios.get(`/api/tasks/unassigned?userName=${userName}`),
            ]);
            setAssignedTasks(assignedRes.data);
            setUnassignedTasks(unassignedRes.data);
        } catch (error) {
            const msg = error.response?.data?.message || "Failed to assign task";
            alert(msg);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const userName = localStorage.getItem('userName');
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const assignedTotalPages = Math.ceil(assignedTasks.length / tasksPerPage);
    const unassignedTotalPages = Math.ceil(unassignedTasks.length / tasksPerPage);
    const pagedAssigned = assignedTasks.slice((assignedPage - 1) * tasksPerPage, assignedPage * tasksPerPage);
    const pagedUnassigned = unassignedTasks.slice((unassignedPage - 1) * tasksPerPage, unassignedPage * tasksPerPage);

    return (
        <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
            <div className="content-area">
                <header className="home-greeting">
                    <h2 className="content-title">{getGreeting()}, {userName}</h2>
                </header>

                {activeTab === 'tasks' ? (
                    <div className="task-split">
                        <div className="task-box">
                            <h3>Assigned To You</h3>
                            {assignedTasks.length > 0 ? (
                                <>
                                    <ul className="task-list">
                                        {pagedAssigned.map(task => (
                                            <li key={task._id} className="task-item">
                                                <div className="task-item-content">
                                                    <strong>{task.title}</strong>
                                                    {task.assignedBy && <p>Assigned by: {task.assignedBy}</p>}
                                                    <p>Deadline: {task.deadline || "Flexible"}</p>
                                                    {task.priority && <span className={`priority-tag ${task.priority.toLowerCase()}`}>{task.priority}</span>}
                                                </div>
                                                <button
                                                    className="complete-btn"
                                                    onClick={() => handleCompleteTask(task._id)}
                                                    title="Mark as completed"
                                                >
                                                    Complete
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    {assignedTotalPages > 1 && (
                                        <div className="pagination">
                                            <button disabled={assignedPage === 1} onClick={() => setAssignedPage(assignedPage - 1)}>Prev</button>
                                            <span>{assignedPage} / {assignedTotalPages}</span>
                                            <button disabled={assignedPage === assignedTotalPages} onClick={() => setAssignedPage(assignedPage + 1)}>Next</button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="empty-msg">You're all caught up! No tasks assigned.</p>
                            )}
                        </div>

                        {!isEmployee && (
                            <div className="task-box">
                                <h3>To Be Assigned</h3>
                                {unassignedTasks.length > 0 ? (
                                    <>
                                        <ul className="task-list">
                                            {pagedUnassigned.map(task => (
                                                <li key={task._id} className="task-item unassigned-item">
                                                    <strong>{task.title}</strong>
                                                    {task.assignedTo && <p>Suggested: {task.assignedTo}</p>}
                                                    <p>Deadline: {task.deadline || "Flexible"}</p>
                                                    {task.priority && <span className={`priority-tag ${task.priority.toLowerCase()}`}>{task.priority}</span>}
                                                    <div className="task-actions">
                                                        {task.assignedTo && (
                                                            <button
                                                                className="small-assign-btn"
                                                                onClick={() => handleAssignFromHome(task)}
                                                            >
                                                                Assign to {task.assignedTo}
                                                            </button>
                                                        )}
                                                        <button
                                                            className="small-assign-btn take-btn"
                                                            onClick={() => handleAssignToMe(task._id)}
                                                        >
                                                            Take Task
                                                        </button>
                                                        <button
                                                            className="small-assign-btn"
                                                            onClick={() => handleDeleteTask(task._id)}
                                                            style={{ color: '#f87171' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                        {unassignedTotalPages > 1 && (
                                            <div className="pagination">
                                                <button disabled={unassignedPage === 1} onClick={() => setUnassignedPage(unassignedPage - 1)}>Prev</button>
                                                <span>{unassignedPage} / {unassignedTotalPages}</span>
                                                <button disabled={unassignedPage === unassignedTotalPages} onClick={() => setUnassignedPage(unassignedPage + 1)}>Next</button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="empty-msg">No pending tasks for assignment.</p>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="history-section">
                        {meetings.length === 0 ? (
                            <p className="empty-msg">Your meeting history will appear here once transcripts are processed.</p>
                        ) : (
                            <div className="task-list">
                                {meetings.map(meeting => (
                                    <div key={meeting._id} className="meeting-card">
                                        <div className="meeting-card-header">
                                            <div>
                                                <strong>{meeting.title || "Untitled Meeting"}</strong>
                                                <p className="meeting-date">{formatDate(meeting.createdAt)}</p>
                                            </div>
                                            <button
                                                className="small-assign-btn"
                                                onClick={() => setExpandedMeeting(expandedMeeting === meeting._id ? null : meeting._id)}
                                            >
                                                {expandedMeeting === meeting._id ? 'Close' : 'View Details'}
                                            </button>
                                        </div>

                                        {expandedMeeting === meeting._id && (
                                            <div className="meeting-details">
                                                <h4>Executive Summary</h4>
                                                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                    {meeting.summary || "No summary available for this meeting."}
                                                </p>
                                                {meeting.actionItems?.length > 0 && (
                                                    <>
                                                        <h4>Action Items</h4>
                                                        <ul className="action-item-list">
                                                            {meeting.actionItems.map((item, i) => (
                                                                <li key={i} style={{ fontSize: '0.9rem', marginBottom: '0.5rem', listStyle: 'inside disc', color: 'var(--text-muted)' }}>
                                                                    <strong>{item.title}</strong>
                                                                    {item.assignedTo && ` (Assigned: ${item.assignedTo})`}
                                                                    {item.deadline && ` [Due: ${item.deadline}]`}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default HomePage;
