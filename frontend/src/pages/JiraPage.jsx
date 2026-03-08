import { useState, useEffect } from 'react';
import api from '../api';
import MainLayout from '../components/MainLayout';
import '../styles/homePage.css';

const JiraPage = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [jiraDetails, setJiraDetails] = useState({ summary: '', description: '' });
    const [showModal, setShowModal] = useState(false);
    const [sendingTasks, setSendingTasks] = useState([]);

    const userName = localStorage.getItem('userName');

    useEffect(() => {
        const fetchData = async () => {
            if (!userName) return;
            try {
                const [tasksRes, userRes] = await Promise.all([
                    api.get(`/api/tasks/assigned/${userName}`),
                    api.get(`/api/users/${userName}`)
                ]);
                setTasks(tasksRes.data);
                setUserEmail(userRes.data.email);
            } catch (error) {
                console.error("Error fetching Jira data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userName]);

    const handleSendClick = (task) => {
        setSelectedTask(task);
        setJiraDetails({
            summary: task.title,
            description: `Task: ${task.title}\nDeadline: ${task.deadline || 'Flexible'}\nPriority: ${task.priority || 'MEDIUM'}`
        });
        setShowModal(true);
    };

    const handleConfirmSend = async () => {
        if (!selectedTask) return;

        setSendingTasks(prev => [...prev, selectedTask._id]);
        setShowModal(false);

        try {
            const response = await api.post('/api/jira/send', {
                taskId: selectedTask._id,
                summary: jiraDetails.summary,
                description: jiraDetails.description,
                assigneeEmail: userEmail,
                priority: selectedTask.priority
            });

            if (response.data.success) {
                setTasks(prevTasks => prevTasks.map(t =>
                    t._id === selectedTask._id ? { ...t, jiraId: response.data.jiraId } : t
                ));
            }
        } catch (error) {
            console.error("Error sending to Jira:", error);
            alert("Failed to send task to Jira. Please check your connection and try again.");
        } finally {
            setSendingTasks(prev => prev.filter(id => id !== selectedTask._id));
            setSelectedTask(null);
        }
    };

    return (
        <MainLayout>
            <div className="content-area">
                <header className="home-greeting">
                    <h2 className="content-title">Jira Integration</h2>
                </header>

                <div className="task-box glass-card">
                    <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{ color: 'var(--text-muted)' }}>Tasks assigned to <strong>{userName}</strong> ({userEmail})</p>
                    </div>

                    {loading ? (
                        <p>Loading tasks...</p>
                    ) : tasks.length > 0 ? (
                        <div className="task-list">
                            {tasks.map(task => (
                                <div key={task._id} className="task-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong>{task.title}</strong>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            {task.deadline && <span>Deadline: {task.deadline} • </span>}
                                            {task.priority && <span className={`priority-tag ${task.priority.toLowerCase()}`}>{task.priority}</span>}
                                        </div>
                                    </div>
                                    <button
                                        className={`btn-primary ${task.jiraId ? 'sent' : ''}`}
                                        style={{
                                            width: 'auto',
                                            padding: '0.5rem 1rem',
                                            fontSize: '0.85rem',
                                            backgroundColor: task.jiraId ? '#28a745' : '',
                                            borderColor: task.jiraId ? '#28a745' : '',
                                            opacity: (task.jiraId || sendingTasks.includes(task._id)) ? 0.7 : 1,
                                            cursor: (task.jiraId || sendingTasks.includes(task._id)) ? 'not-allowed' : 'pointer'
                                        }}
                                        onClick={() => handleSendClick(task)}
                                        disabled={task.jiraId || sendingTasks.includes(task._id)}
                                    >
                                        {sendingTasks.includes(task._id) ? 'Sending...' : (task.jiraId ? 'Sent' : 'Send to Jira')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="empty-msg">No tasks assigned to you yet.</p>
                    )}
                </div>

                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="classy-modal" onClick={(e) => e.stopPropagation()}>
                            <h3>Create Jira Issue</h3>
                            <p className="modal-subtitle">Review and refine the task details before syncing to Jira.</p>

                            <div className="classy-form-group">
                                <label className="classy-label">Issue Summary</label>
                                <input
                                    type="text"
                                    className="classy-input"
                                    value={jiraDetails.summary}
                                    onChange={(e) => setJiraDetails({ ...jiraDetails, summary: e.target.value })}
                                />
                            </div>

                            <div className="classy-form-group">
                                <label className="classy-label">Description</label>
                                <textarea
                                    className="classy-input"
                                    style={{ height: '140px', resize: 'none' }}
                                    value={jiraDetails.description}
                                    onChange={(e) => setJiraDetails({ ...jiraDetails, description: e.target.value })}
                                />
                            </div>

                            <div className="classy-actions">
                                <button className="btn-classy-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button className="btn-classy-primary" onClick={handleConfirmSend}>
                                    Confirm & Sync
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default JiraPage;
