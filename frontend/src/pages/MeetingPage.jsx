import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import MainLayout from '../components/MainLayout';

const MeetingPage = () => {
    const [meetingTitle, setMeetingTitle] = useState('');
    const [file, setFile] = useState(null);
    const [summary, setSummary] = useState('');
    const [actionItems, setActionItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async () => {
        if (!file) {
            alert("Please Upload a Word File");
            return;
        }

        setLoading(true);
        setSummary("Reading Doc...");
        setShowResults(true);
        setActionItems([]);

        const prompt = `
        You are a professional meeting analysis assistant. Don't add any asterisks or bolding throughout the response.
    
        I will provide a meeting transcript below.
    
        Your task is to analyze the transcript and respond in EXACTLY TWO sections using the markers [[SUMMARY]] and [[ACTION_ITEMS]].
        
        Do NOT include action items in the Summary section.
        
        [[SUMMARY]]
        Provide clear well-structured summary of the meeting.
        The summary must:
        - Clearly mention key discussion points.
        - Specify who said what (attribute statements to speakers where possible).
        - Highlight important decisions made.
        - State the final conclusion or outcome of the meeting.
        - Be written in professional, concise language.
        - Use bullet points where appropriate.
        
        [[ACTION_ITEMS]]
        List all final action items mentioned in the meeting.
    
        For EACH action item, include:
        - Task: What needs to be done
        - Assigned To: Who is responsible
        - Assigned By: Who assigned the task (if mentioned)
        - Deadline: Deadline (if mentioned; otherwise write "Not specified")
        - Priority: Evaluate priority using:
          1. Urgency — deadlines or immediate action required
          
          2. Impact — effect on project or team progress
          3. Dependency — whether other work depends on it
          4. Business importance — delivery, users, or decisions affected
          Priority Levels: HIGH, MEDIUM, LOW. Assign exactly one.
    
        Only include confirmed action items — do NOT include suggestions that were not finalized.
    
        Format each action item clearly and separately.
        `;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("prompt", prompt);

        try {
            const response = await axios.post("/ask", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const data = response.data;

            const summaryMarker = "[[SUMMARY]]";
            const actionMarker = "[[ACTION_ITEMS]]";

            const summaryIndex = data.indexOf(summaryMarker);
            const actionIndex = data.indexOf(actionMarker);

            let summaryText = "";
            let actionText = "";

            if (summaryIndex !== -1 && actionIndex !== -1) {
                if (summaryIndex < actionIndex) {
                    summaryText = data.substring(summaryIndex + summaryMarker.length, actionIndex).trim();
                    actionText = data.substring(actionIndex + actionMarker.length).trim();
                } else {
                    actionText = data.substring(actionIndex + actionMarker.length, summaryIndex).trim();
                    summaryText = data.substring(summaryIndex + summaryMarker.length).trim();
                }
            } else {
                const parts = data.split(/ACTION ITEMS|\[\[ACTION_ITEMS\]\]/i);
                summaryText = (parts[0] || "").replace(/\[\[SUMMARY\]\]|SECTION 1: SUMMARY/gi, "").trim();
                actionText = (parts[1] || "").trim();
            }

            setSummary(summaryText);

            const rawItems = actionText.split(/Task:/i).filter(item => item.trim().length > 0).slice(1);
            const parsedItems = rawItems.map(item => {
                let task = "";
                let assignedTo = "";
                let assignedBy = "";
                let deadline = "";
                let priority = "MEDIUM";
                const lines = item.split('\n');
                task = lines[0].trim();

                lines.forEach(line => {
                    const lowerLine = line.toLowerCase();
                    if (lowerLine.includes('assigned to:')) assignedTo = line.split(':')[1]?.trim() || "";
                    if (lowerLine.includes('assigned by:')) assignedBy = line.split(':')[1]?.trim() || "";
                    if (lowerLine.includes('deadline:')) deadline = line.split(':')[1]?.trim() || "";
                    if (lowerLine.includes('priority:')) {
                        const val = line.split(':')[1]?.toUpperCase() || "";
                        if (val.includes("HIGH")) priority = "HIGH";
                        else if (val.includes("LOW")) priority = "LOW";
                        else if (val.includes("MEDIUM")) priority = "MEDIUM";
                    }
                });
                return {
                    title: task || item.trim(),
                    assignedTo,
                    assignedBy,
                    deadline,
                    priority,
                };
            }).filter(item => item.title && item.title.trim().length > 0);

            const finalItems = parsedItems.length === 0
                ? [{ title: "Action Item", assignedTo: "", assignedBy: "", deadline: "", priority: "MEDIUM" }]
                : parsedItems;

            const userName = localStorage.getItem('userName');
            const savedItems = await Promise.all(
                finalItems.map(async (item) => {
                    try {
                        const res = await axios.post('/api/tasks', {
                            title: item.title,
                            userName,
                            assignedTo: item.assignedTo || "",
                            assignedBy: item.assignedBy,
                            deadline: item.deadline,
                            priority: item.priority,
                            isAssigned: false,
                        });
                        return { ...item, _id: res.data._id, status: 'pending' };
                    } catch {
                        return { ...item, _id: null, status: 'pending' };
                    }
                })
            );

            setActionItems(savedItems);

            if (userName) {
                try {
                    await axios.post('/api/meetings', {
                        title: meetingTitle || "Untitled Meeting",
                        userName,
                        summary: summaryText.trim(),
                        actionItems: finalItems,
                    });
                } catch (err) {
                    console.error("Failed to save meeting to history:", err);
                }
            }

        } catch (error) {
            console.error(error);
            setSummary(error.response?.data?.message || error.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (item, index) => {
        if (!item._id) {
            alert("Task ID missing. Please refresh and try again.");
            return;
        }
        try {
            await axios.patch(`/api/tasks/assign/${item._id}`, {
                assignedToText: item.assignedTo,
            });

            setActionItems(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], status: 'assigned' };
                return updated;
            });
        } catch (error) {
            const msg = error.response?.data?.message || "Failed to assign task";
            alert(msg);
        }
    };

    const handleDelete = async (item, index) => {
        if (item._id) {
            try {
                await axios.delete(`/api/tasks/${item._id}`);
            } catch (err) {
                console.error("Failed to delete task from DB:", err);
            }
        }
        setActionItems(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <MainLayout>
            <div className="content-area">
                <header className="home-greeting">
                    <h2 className="content-title">Generate Minutes</h2>
                </header>

                <div className="task-box glass-card" style={{ marginBottom: '2rem' }}>
                    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="label-main">Meeting Title</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. Weekly Standup"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="label-main">Transcript File (.txt,.docx)</label>
                            <input
                                type="file"
                                className="input-field"
                                accept=".txt,.pdf,.docx"
                                onChange={(e) => setFile(e.target.files[0])}
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? "Processing..." : "Generate Insights"}
                        </button>
                    </form>
                </div>

                {showResults && (
                    <div className="results-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                        <div className="task-box glass-card" style={{ marginBottom: '2rem' }}>
                            <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>Summary</h3>
                            <div className="result-content" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-main)', lineHeight: '1.6' }}>{summary}</div>
                        </div>

                        <div className="task-box glass-card">
                            <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>Action Items</h3>
                            <div className="task-list">
                                {actionItems.filter(item => item.title && item.title.trim().length > 0).map((item, index) => (
                                    <div key={item._id || index} className="task-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong>{item.title}</strong>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                {item.assignedTo && <span>Assigned To: {item.assignedTo} • </span>}
                                                {item.deadline && <span>Deadline: {item.deadline}</span>}
                                                {item.priority && <span className={`priority-tag ${item.priority.toLowerCase()}`}> • {item.priority}</span>}
                                            </div>
                                        </div>

                                        <div className="task-actions">
                                            {item.status === 'assigned' ? (
                                                <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '0.85rem' }}>✓ Assigned</span>
                                            ) : (
                                                <>
                                                    <button className="small-assign-btn" onClick={() => handleAssign(item, index)}>
                                                        Save
                                                    </button>
                                                    <button className="small-assign-btn" style={{ color: '#f87171' }} onClick={() => handleDelete(item, index)}>
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default MeetingPage;
