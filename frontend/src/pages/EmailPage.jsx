import { useState, useEffect } from 'react';
import api from '../api';
import MainLayout from '../components/MainLayout';

import { sendEmailToTask } from '../services/emailService';

const EmailPage = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState(null);
    const [notes, setNotes] = useState('');
    const [recipient, setRecipient] = useState('');
    const [ccEmail, setCcEmail] = useState('');
    const [draft, setDraft] = useState('');
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [sentTasks, setSentTasks] = useState(() => {
        const saved = localStorage.getItem('sentEmailTasks');
        return saved ? JSON.parse(saved) : [];
    });

    const keywords = [/email/i, /gmail/i, /mail/i];

    useEffect(() => {
        localStorage.setItem('sentEmailTasks', JSON.stringify(sentTasks));
    }, [sentTasks]);

    useEffect(() => {
        const fetchAssigned = async () => {
            const userName = localStorage.getItem('userName');
            if (!userName) return;
            try {
                const res = await api.get(`/api/tasks/assigned/${userName}`);
                const filtered = res.data.filter(task =>
                    keywords.some(rx => rx.test(task.title))
                );
                setTasks(filtered);
            } catch (err) {
                console.error('Error fetching tasks', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAssigned();
    }, []);

    const handleStart = async (task) => {
        setSelectedTask(task);
        setNotes('');
        setRecipient('');
        setCcEmail('');
        setDraft('');
        setEmailSent(false);

        try {

            const usersRes = await api.get('/api/users');
            const allUsers = usersRes.data;

            const title = task.title.toLowerCase();
            let foundUser = null;


            for (const u of allUsers) {
                const fname = (u.firstName || '').toLowerCase();
                const lname = (u.lastName || '').toLowerCase();
                const uname = (u.userName || '').toLowerCase();

                const nameInTitle = (name) => {
                    if (!name || name.length < 2) return false;
                    const regex = new RegExp(`\\b${name.toLowerCase()}\\b`, 'i');
                    return regex.test(title);
                };

                if (nameInTitle(fname) || nameInTitle(lname) || nameInTitle(uname)) {
                    foundUser = u;
                    break;
                }
            }

            if (foundUser) {
                console.log(`[EmailPage] Found user "${foundUser.userName}" in task title`);
                setRecipient(foundUser.email);
            } else if (task.assignedBy) {
                console.log(tasks);
                console.log(`[EmailPage] No name found in title, falling back to assignedBy "${task.userName}"`);
                const assignerRes = await api.get(`/api/users/${task.userName}`);
                if (assignerRes.data && assignerRes.data.email) {
                    setRecipient(assignerRes.data.email);
                    console.log(recipient);
                }
            }
        } catch (err) {
            console.error("Error determining recipient:", err);
        }


        const userName = localStorage.getItem('userName');
        if (userName) {
            try {
                const res = await api.get(`/api/users/${userName}`);
                if (res.data && res.data.email) {
                    setCcEmail(res.data.email);
                }
            } catch (err) {
                console.error("Error fetching current user email:", err);
            }
        }
    };

    const handleGenerate = async () => {
        if (!selectedTask || !recipient.trim()) return;
        setGenerating(true);
        const descriptionForDraft = notes.trim() || "No additional notes provided.";
        try {
            const res = await api.post('/api/email/draft', {
                taskId: selectedTask._id,
                description: descriptionForDraft,
                recipient
            });
            setDraft(res.data.draft);
        } catch (err) {
            console.error('Draft error', err);
            alert('Failed to generate draft');
        } finally {
            setGenerating(false);
        }
    };

    const handleSend = async () => {
        if (!selectedTask || !draft.trim() || !recipient.trim()) return;

        setSending(true);
        try {
            const result = await sendEmailToTask({
                taskId: selectedTask._id,
                body: draft,
                recipient,
                taskTitle: selectedTask.title,
                ccEmail
            });

            if (result.success) {
                alert(`${result.message}\nSent to: ${result.to}`);
                setEmailSent(true);
                setSentTasks([...sentTasks, selectedTask._id]);
                setNotes('');
            } else {
                alert(`Failed to send email\n${result.message}`);
                console.error('Email send failure:', result.error);
            }
        } catch (err) {
            console.error('Unexpected error in handleSend:', err);
            alert('An unexpected error occurred. Please check the console.');
        } finally {
            setSending(false);
        }
    };

    return (
        <MainLayout>
            <div className="content-area">
                <header className="home-greeting">
                    <h2 className="content-title">Email Tasks</h2>
                </header>
                {loading ? (
                    <p className="empty-msg">Loading...</p>
                ) : tasks.length === 0 ? (
                    <p className="empty-msg">No email-related tasks found.</p>
                ) : (
                    <ul className="task-list">
                        {tasks.map(task => (
                            <li key={task._id} className="task-item">
                                <div className="task-item-content">
                                    <strong>{task.title}</strong>
                                    {task.assignedBy && <p>Assigned by: {task.assignedBy}</p>}
                                </div>
                                <button
                                    className="small-assign-btn"
                                    onClick={() => handleStart(task)}
                                    disabled={sentTasks.includes(task._id)}
                                    style={{
                                        backgroundColor: sentTasks.includes(task._id) ? '#4ade80' : undefined,
                                        borderColor: sentTasks.includes(task._id) ? '#4ade80' : undefined,
                                        cursor: sentTasks.includes(task._id) ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {sentTasks.includes(task._id) ? 'Sent' : 'Send'}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {selectedTask && (
                    <div className="email-draft-box">
                        <h3>Compose Email for: {selectedTask.title}</h3>

                        {!draft ? (
                            <>
                                <div className="classy-form-group">
                                    <label className="classy-label">Recipient Email</label>
                                    <input
                                        placeholder="Recipient's email address"
                                        className="classy-input"
                                        value={recipient}
                                        onChange={e => setRecipient(e.target.value)}
                                        style={{ width: '100%', marginBottom: '0.75rem' }}
                                    />
                                </div>
                                <div className="classy-form-group">
                                    <label className="classy-label">CC Email</label>
                                    <input
                                        placeholder="email address"
                                        className="classy-input"
                                        value={ccEmail}
                                        onChange={e => setCcEmail(e.target.value)}
                                        style={{ width: '100%', marginBottom: '0.75rem' }}
                                    />
                                </div>
                                <div className="classy-form-group">
                                    <label className="classy-label">Notes for Email</label>
                                    <textarea
                                        placeholder="Enter key points for the email..."
                                        className="classy-input"
                                        rows={6}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                </div>
                                <div className="classy-actions" style={{ marginTop: '1rem' }}>
                                    <button onClick={() => setSelectedTask(null)} className="btn-classy-secondary">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={generating || !recipient.trim()}
                                        className="btn-classy-primary"
                                        title={!recipient.trim() ? "Cannot generate draft without a recipient. Assign the task or mention a name in the title." : ""}
                                    >
                                        {generating ? 'Generating...' : 'Generate Draft'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="classy-form-group">
                                    <label className="classy-label">Review & Edit Draft</label>
                                    <textarea
                                        className="classy-input"
                                        rows={10}
                                        value={draft}
                                        onChange={e => setDraft(e.target.value)}
                                    />
                                </div>
                                <div className="classy-actions" style={{ marginTop: '1rem' }}>
                                    <button
                                        onClick={() => emailSent ? setSelectedTask(null) : setDraft('')}
                                        className="btn-classy-secondary"
                                        disabled={sending}
                                    >
                                        {emailSent ? 'Close' : 'Back to Notes'}
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={sending || emailSent || !draft.trim()}
                                        className="btn-classy-primary"
                                        style={{
                                            backgroundColor: emailSent ? '#4ade80' : undefined,
                                            borderColor: emailSent ? '#4ade80' : undefined,
                                            cursor: emailSent ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {sending ? 'Sending...' : emailSent ? 'Sent' : 'Send Email'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default EmailPage;
