import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { usePendingFile } from '../context/PendingFileContext.jsx';
import { useChatMeeting } from '../context/ChatMeetingContext.jsx';
import '../styles/chatAgent.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHIPS = [
    { label: '📅 My Meetings',    text: 'show my meetings'               },
    { label: '✅ My Tasks',        text: 'show my tasks'                  },
    { label: '📊 My Analytics',   text: 'show my analytics'              },
    { label: '📝 Weekly Digest',   text: 'generate weekly digest'         },
    { label: '🏢 Team Stats',      text: 'show team performance'          },
    { label: '✔️ Completed',       text: 'show my completed tasks'        },
    { label: '🗣️ Meeting Q&A',     text: 'ask questions about a meeting'  },
    { label: '🔍 Search...',       special: 'search'                      },
    { label: '📄 Attach Doc',      special: 'doc'                         },
];

// Floating hint chips shown near the FAB when the panel is closed
const FAB_HINTS = [
    { label: '📊 My Analytics', text: 'show my analytics' },
    { label: '✅ My Tasks',      text: 'show my tasks'     },
    { label: '📅 My Meetings',   text: 'show my meetings'  },
];

const WELCOME = `Hi! I'm **FirstMeet AI** 👋

I can help you with:
• 📅 Meeting history & summaries
• ✅ Tasks & deadlines
• 📊 Personal & team analytics
• �️ Ask questions about any meeting
• 📄 Document Q&A & full insights
• 🔍 Search across all your meetings

Try a quick action below, or just ask me anything!`;

const PRIORITY_COLORS = { HIGH: '#FF453A', MEDIUM: '#FF9F0A', LOW: '#30D158' };

// ─── Markdown renderer ────────────────────────────────────────────────────────
// Handles **bold**, *italic*, numbered lists, bullet lists

const inlineMd = (str) =>
    str
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');

const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let listType  = null;

    const flushList = () => {
        if (!listItems.length) return;
        const items = listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
        ));
        elements.push(listType === 'ol'
            ? <ol key={`list-${elements.length}`} className="ca-md-list">{items}</ol>
            : <ul key={`list-${elements.length}`} className="ca-md-list">{items}</ul>
        );
        listItems = [];
        listType  = null;
    };

    lines.forEach((line, i) => {
        const olMatch = line.match(/^\d+\.\s+(.*)/);
        const ulMatch = line.match(/^[•\-]\s+(.*)/);

        if (olMatch) {
            if (listType !== 'ol') { flushList(); listType = 'ol'; }
            listItems.push(olMatch[1]);
        } else if (ulMatch) {
            if (listType !== 'ul') { flushList(); listType = 'ul'; }
            listItems.push(ulMatch[1]);
        } else {
            flushList();
            if (line.trim() === '') {
                if (elements.length > 0) elements.push(<br key={`br-${i}`} />);
            } else {
                elements.push(
                    <p key={`p-${i}`} className="ca-md-para" dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />
                );
            }
        }
    });
    flushList();
    return elements;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const WelcomeText = ({ text }) => (
    <div className="ca-welcome">
        {text.split('\n').map((line, i) => {
            const bold = line.replace(/\*\*(.+?)\*\*/g, (_, b) => `<strong>${b}</strong>`);
            return line.trim() === ''
                ? <br key={i} />
                : <p key={i} dangerouslySetInnerHTML={{ __html: bold }} />;
        })}
    </div>
);

const MeetingCard = ({ m, onNav }) => (
    <div className="ca-meeting-card">
        <div className="ca-meeting-info">
            <div className="ca-meeting-title">{m.title || 'Untitled Meeting'}</div>
            <div className="ca-meeting-meta">
                {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {m.actionItemsCount ?? 0} action items
            </div>
            {m.summary && (
                <div className="ca-meeting-summary">
                    {m.summary.length > 110 ? m.summary.slice(0, 110) + '…' : m.summary}
                </div>
            )}
        </div>
        <button className="ca-pill-btn" onClick={() => onNav('/meeting')}>View →</button>
    </div>
);

const MeetingDetail = ({ m, onNav }) => (
    <div className="ca-meeting-card detail-card">
        <div className="ca-detail-header">
            <div className="ca-meeting-title">{m.title}</div>
            <div className="ca-meeting-meta">{new Date(m.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
        {m.summary && <p className="ca-detail-summary">{m.summary}</p>}
        {(m.actionItems || []).length > 0 && (
            <div className="ca-detail-actions">
                <div className="ca-section-label">Action Items</div>
                {m.actionItems.map((a, i) => (
                    <div key={i} className="ca-action-row">
                        <span className="ca-action-dot">•</span>
                        <span className="ca-action-text">{a.task || a.title}</span>
                        {a.assignedTo && <span className="ca-action-assignee">→ {a.assignedTo}</span>}
                    </div>
                ))}
            </div>
        )}
        <button className="ca-block-btn" onClick={() => onNav('/meeting')}>📅 Open Meetings Page →</button>
    </div>
);

const TaskPill = ({ task }) => {
    const color = PRIORITY_COLORS[task.priority] || '#888';
    return (
        <div className="ca-task-pill" style={{ borderLeftColor: color }}>
            <span className={`ca-task-status ${task.isCompleted ? 'done' : ''}`}>
                {task.isCompleted ? '✓' : '○'}
            </span>
            <span className="ca-task-title">{task.title}</span>
            <span className="ca-task-priority" style={{ color }}>{task.priority}</span>
            {task.deadline && <span className="ca-task-due">{task.deadline}</span>}
        </div>
    );
};

const TasksView = ({ data, onNav }) => (
    <div className="ca-data-block">
        {data.pending?.length > 0 && (
            <>
                <div className="ca-section-label">Pending ({data.pending.length})</div>
                {data.pending.slice(0, 6).map(t => <TaskPill key={t._id} task={t} />)}
                {data.pending.length > 6 && <div className="ca-more-hint">+{data.pending.length - 6} more pending</div>}
            </>
        )}
        {data.completed?.length > 0 && (
            <>
                <div className="ca-section-label" style={{ marginTop: '0.5rem' }}>Completed ({data.completed.length})</div>
                {data.completed.slice(0, 4).map(t => <TaskPill key={t._id} task={t} />)}
                {data.completed.length > 4 && <div className="ca-more-hint">+{data.completed.length - 4} more completed</div>}
            </>
        )}
        {(!data.pending?.length && !data.completed?.length) && (
            <div className="ca-empty">No tasks found 🎉</div>
        )}
        <button className="ca-block-btn" onClick={() => onNav('/home')}>✅ Open Tasks Page →</button>
    </div>
);

const StatCard = ({ label, value, color = '#0D99FF' }) => (
    <div className="ca-stat-card">
        <div className="ca-stat-value" style={{ color }}>{value}</div>
        <div className="ca-stat-label">{label}</div>
    </div>
);

const TeamStatsView = ({ data, onNav }) => (
    <div className="ca-data-block">
        <div className="ca-stats-grid">
            <StatCard label="Completion Rate"     value={`${data.completionRate}%`} color="#30D158"  />
            <StatCard label="Total Tasks"          value={data.totalTasks}           color="#0D99FF"  />
            <StatCard label="Total Meetings"       value={data.totalMeetings}        color="#BF5AF2"  />
            <StatCard label="HIGH Priority Open"   value={data.highPriority}         color="#FF453A"  />
        </div>
        {data.members?.length > 0 && (
            <div className="ca-leaderboard">
                <div className="ca-section-label">Top Performers</div>
                {data.members.slice(0, 3).map((m, i) => (
                    <div key={i} className="ca-lb-row">
                        <span className="ca-lb-rank">{['🥇', '🥈', '🥉'][i]}</span>
                        <span className="ca-lb-name">{m.name}</span>
                        <div className="ca-lb-bar-wrap">
                            <div className="ca-lb-bar" style={{ width: `${m.ratio}%`, background: m.ratio >= 70 ? '#30D158' : m.ratio >= 40 ? '#FF9F0A' : '#FF453A' }} />
                        </div>
                        <span className="ca-lb-rate" style={{ color: m.ratio >= 70 ? '#30D158' : '#FF9F0A' }}>{m.ratio}%</span>
                    </div>
                ))}
            </div>
        )}
        <button className="ca-block-btn" onClick={() => onNav('/analytics')}>📊 View Full Analytics →</button>
    </div>
);

const MyStatsView = ({ data, onNav }) => (
    <div className="ca-data-block">
        <div className="ca-stats-grid">
            <StatCard label="Completion Rate"  value={`${data.rate}%`}          color="#30D158"  />
            <StatCard label="Pending Tasks"    value={data.pendingCount}         color="#FF9F0A"  />
            <StatCard label="Weekly Focus"     value={`${data.focusScore}%`}    color="#0D99FF"  />
            <StatCard label="Meetings"         value={data.meetingsCount}        color="#BF5AF2"  />
        </div>
        <div className="ca-focus-detail">
            {data.completedThisWeek} of {data.assignedThisWeek} tasks completed this week
        </div>
        <button className="ca-block-btn" onClick={() => onNav('/analytics')}>📈 Open My Dashboard →</button>
    </div>
);

const NavView = ({ navTarget, onNav }) => {
    const labels = { '/analytics': 'Analytics', '/meeting': 'Meetings', '/home': 'Tasks', '/email': 'Email', '/jira': 'Jira', '/completed': 'Completed Tasks' };
    return (
        <div className="ca-data-block">
            <button className="ca-block-btn nav-highlight" onClick={() => onNav(navTarget)}>
                🚀 Take me to {labels[navTarget] || navTarget} →
            </button>
        </div>
    );
};

const InsightView = ({ insight, fileName }) => (
    <div className="ca-insight-block">
        <div className="ca-insight-file">📄 {fileName}</div>
        {insight.summary && (
            <div className="ca-insight-section">
                <div className="ca-section-label blue">Summary</div>
                <p>{insight.summary}</p>
            </div>
        )}
        {insight.keyDecisions?.length > 0 && (
            <div className="ca-insight-section">
                <div className="ca-section-label blue">Key Decisions</div>
                <ul>{insight.keyDecisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
        )}
        {insight.actionItems?.length > 0 && (
            <div className="ca-insight-section">
                <div className="ca-section-label blue">Action Items</div>
                {insight.actionItems.map((a, i) => (
                    <div key={i} className="ca-action-row">
                        <span className="ca-action-dot">•</span>
                        <span className="ca-action-text">{a.task || String(a)}</span>
                        {a.assignedTo && a.assignedTo !== 'TBD' && (
                            <span className="ca-action-assignee">→ {a.assignedTo}</span>
                        )}
                    </div>
                ))}
            </div>
        )}
        {insight.risks?.length > 0 && (
            <div className="ca-insight-section">
                <div className="ca-section-label orange">⚠️ Risks</div>
                <ul>{insight.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
        )}
    </div>
);

// ─── DocActionView ────────────────────────────────────────────────────────────

const DocActionView = ({ fileName, onAsk, onInsights, frozen }) => {
    const [chosen, setChosen] = useState(null);
    const disabled = frozen || chosen !== null;
    return (
        <div className="ca-data-block">
            <div className="ca-doc-attached">📄 <strong>{fileName}</strong></div>
            <div className="ca-doc-opts">
                <button
                    type="button"
                    className={`ca-doc-opt ask${chosen === 'ask' ? ' chosen' : ''}`}
                    disabled={disabled}
                    onClick={() => { setChosen('ask'); onAsk(); }}
                >
                    💬 Ask questions about this document
                </button>
                <button
                    type="button"
                    className={`ca-doc-opt insights${chosen === 'insights' ? ' chosen' : ''}`}
                    disabled={disabled}
                    onClick={() => { setChosen('insights'); onInsights(); }}
                >
                    🔍 Generate full insights on Meeting Page
                </button>
            </div>
        </div>
    );
};

// ─── InsightConfirmView ───────────────────────────────────────────────────────

const InsightConfirmView = ({ fileName, onConfirm, onCancel, frozen }) => {
    const [done, setDone] = useState(false);
    const disabled = frozen || done;
    return (
        <div className="ca-data-block">
            <p className="ca-confirm-text">
                I'll open the <strong>Meeting Page</strong> and automatically load <em>{fileName}</em> there for full insight generation — summary, action items, and task creation.
            </p>
            <div className="ca-confirm-btns">
                <button
                    type="button"
                    className="ca-block-btn"
                    disabled={disabled}
                    onClick={() => { setDone(true); onConfirm(); }}
                >
                    ✅ Confirm — Open Meeting Page →
                </button>
                <button
                    type="button"
                    className="ca-cancel-btn"
                    disabled={disabled}
                    onClick={() => { setDone(true); onCancel(); }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

// ─── MeetingPickerView ────────────────────────────────────────────────────────

const MeetingPickerView = ({ meetings, onAction, frozen }) => {
    const [selected, setSelected] = useState([]);

    const toggle = (id) => setSelected(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

    const confirm = () => {
        const chosen = meetings.filter(m => selected.includes(String(m._id)));
        onAction({ type: 'confirm_meetings', meetings: chosen });
    };

    if (frozen) {
        return <div className="ca-picker-done">✓ Meeting selected for Q&A</div>;
    }

    return (
        <div className="ca-data-block">
            <div className="ca-section-label">Tap to select • then confirm</div>
            {meetings.length === 0 && <div className="ca-empty">No meetings found.</div>}
            {meetings.map(m => {
                const id  = String(m._id);
                const sel = selected.includes(id);
                return (
                    <button
                        key={id}
                        type="button"
                        className={`ca-meeting-opt${sel ? ' ca-meeting-opt-sel' : ''}`}
                        onClick={() => toggle(id)}
                    >
                        {sel && <span className="ca-opt-check">✓</span>}
                        <span className="ca-meeting-opt-body">
                            <span className="ca-meeting-opt-title">{m.title}</span>
                            <span className="ca-meeting-opt-date">
                                {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </span>
                    </button>
                );
            })}
            <button
                type="button"
                className="ca-block-btn"
                onClick={confirm}
                disabled={!selected.length}
                style={{ marginTop: '0.5rem' }}
            >
                Start Q&A with {selected.length || ''} meeting{selected.length !== 1 ? 's' : ''} →
            </button>
        </div>
    );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

const MessageBubble = ({ msg, onNav, onAction, isLastMsg }) => {
    const isUser = msg.role === 'user';

    const renderRichContent = () => {
        if (msg.type === 'meetings' && msg.data) {
            return (
                <div className="ca-data-block">
                    {msg.data.length > 0
                        ? msg.data.map(m => <MeetingCard key={m._id} m={m} onNav={onNav} />)
                        : <div className="ca-empty">No meetings found.</div>
                    }
                    <button className="ca-block-btn" onClick={() => onNav('/meeting')}>📅 Open Meetings Page →</button>
                </div>
            );
        }
        if (msg.type === 'meeting_detail' && msg.data) return <MeetingDetail m={msg.data} onNav={onNav} />;
        if (msg.type === 'tasks'          && msg.data) return <TasksView data={msg.data} onNav={onNav} />;
        if (msg.type === 'team_stats'     && msg.data) return <TeamStatsView data={msg.data} onNav={onNav} />;
        if (msg.type === 'my_stats'       && msg.data) return <MyStatsView data={msg.data} onNav={onNav} />;
        if (msg.type === 'nav'            && msg.navTarget) return <NavView navTarget={msg.navTarget} onNav={onNav} />;
        if (msg.type === 'insight'        && msg.insight) return <InsightView insight={msg.insight} fileName={msg.fileName} />;

        if (msg.type === 'doc_action') return (
            <DocActionView
                fileName={msg.docFileName}
                frozen={!isLastMsg}
                onAsk={() => onAction({ type: 'doc_action', choice: 'ask', fileName: msg.docFileName })}
                onInsights={() => onAction({ type: 'doc_action', choice: 'insights', fileName: msg.docFileName })}
            />
        );
        if (msg.type === 'insight_confirm') return (
            <InsightConfirmView
                fileName={msg.docFileName}
                frozen={!isLastMsg}
                onConfirm={() => onAction({ type: 'confirm_insights' })}
                onCancel={() => onAction({ type: 'cancel_insights' })}
            />
        );
        if (msg.type === 'meeting_picker' && msg.data) return (
            <MeetingPickerView
                meetings={msg.data}
                frozen={!isLastMsg}
                onAction={onAction}
            />
        );
        return null;
    };

    return (
        <div className={`ca-msg-row ${isUser ? 'user' : 'bot'}`}>
            {!isUser && (
                <div className="ca-avatar">AI</div>
            )}
            <div className={`ca-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
                {isUser ? (
                    msg.fileInfo
                        ? <div className="ca-file-msg"><span>📄</span><span>{msg.fileInfo}</span></div>
                        : <span>{msg.content}</span>
                ) : (
                    <>
                        {msg.isWelcome
                            ? <WelcomeText text={msg.content} />
                            : msg.content && <div className="ca-reply-text">{renderMarkdown(msg.content)}</div>
                        }
                        {renderRichContent()}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ChatAgent = () => {
    const [open, setOpen]           = useState(false);
    const [fabHovered, setFabHovered] = useState(false);
    const [pendingAutoMsg, setPendingAutoMsg] = useState(null);
    const [input, setInput]         = useState('');
    const [loading, setLoading]     = useState(false);
    const [messages, setMessages]   = useState([
        { role: 'assistant', content: WELCOME, type: 'text', isWelcome: true },
    ]);
    // Document Q&A state
    const [docFile, setDocFile]             = useState(null);   // raw File
    const [docTextContent, setDocText]      = useState('');     // extracted text for Q&A
    // Meeting Q&A state
    const [meetingQAContext, setMeetingQAContext] = useState(null); // array of meeting objects

    const { setPendingFile, setPendingTitle } = usePendingFile();
    const { pendingMeetings, setPendingMeetings } = useChatMeeting();

    const fileRef     = useRef(null);
    const messagesRef = useRef(null);
    const inputRef    = useRef(null);
    const navigate    = useNavigate();

    const userName = localStorage.getItem('userName') || '';
    const userRole = localStorage.getItem('userRole') || 'employee';

    // Scroll only the messages container — never the page
    useEffect(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, [messages, loading]);

    // Focus input when panel opens
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 350);
    }, [open]);

    // Consume external meeting selection (multi-select from History / Meeting pages)
    useEffect(() => {
        if (!pendingMeetings?.length) return;
        const meetings = [...pendingMeetings];
        setPendingMeetings(null);
        setOpen(true);
        setMeetingQAContext(meetings);
        const msg = meetings.length === 1
            ? `Tell me about the meeting: "${meetings[0].title}"`
            : `Compare these meetings: ${meetings.map(m => `"${m.title}"`).join(', ')}`;
        setPendingAutoMsg(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingMeetings]);

    // Load history from MongoDB on mount
    useEffect(() => {
        if (!userName) return;
        api.get(`/api/chat/history?userName=${encodeURIComponent(userName)}`)
            .then(res => {
                const saved = res.data.messages || [];
                if (saved.length > 0) {
                    setMessages(prev => [prev[0], ...saved]); // keep welcome msg at top
                }
            })
            .catch(() => {});
    }, []);

    // Don't render on sign-in / sign-up pages
    if (!userName) return null;

    const handleNav = useCallback((path) => {
        setOpen(false);
        navigate(path);
    }, [navigate]);

    const getHistory = (msgs) =>
        msgs
            .filter(m => !m.isWelcome && (m.role === 'user' || m.role === 'assistant') && m.content)
            .slice(-12)
            .map(m => ({ role: m.role, content: m.content }));

    const pushMsg = (msg) => setMessages(prev => [...prev, msg]);

    const sendMessage = async (text, overrideExtra = {}) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const userMsg = { role: 'user', content: trimmed, type: 'text', ...overrideExtra };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await api.post('/api/chat/message', {
                message:        trimmed,
                userName,
                userRole,
                history:        getHistory([...messages, userMsg]),
                docContext:     docTextContent   || undefined,
                meetingContext: meetingQAContext  || undefined,
            });

            const { reply, type, data, navTarget, insight, fileName } = res.data;
            const botMsg = { role: 'assistant', content: reply, type: type || 'text', data, navTarget, insight, fileName };
            pushMsg(botMsg);

            // Persist to MongoDB
            api.post('/api/chat/history/append', {
                userName,
                messages: [
                    { role: 'user',      content: trimmed, type: 'text' },
                    { role: 'assistant', content: reply,   type: type || 'text', navTarget, insight, fileName },
                ],
            }).catch(() => {});

            if (type === 'nav' && navTarget) {
                setTimeout(() => handleNav(navTarget), 2200);
            }
        } catch (err) {
            console.error('Chat API error:', err);
            const detail = err?.response?.data?.message || err?.message || '';
            pushMsg({ role: 'assistant', content: `Something went wrong${detail ? ': ' + detail : ''}. Make sure the backend server is running on port 5000.`, type: 'text' });
        } finally {
            setLoading(false);
        }
    };

    // Fire the auto-message once the panel is open (triggered by external meeting selection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!pendingAutoMsg || !open) return;
        const t = setTimeout(() => {
            sendMessage(pendingAutoMsg);
            setPendingAutoMsg(null);
        }, 450);
        return () => clearTimeout(t);
    }, [pendingAutoMsg, open]);

    const handleHintClick = (hint) => {
        setOpen(true);
        // Small delay so the panel animates in before the message is added
        setTimeout(() => sendMessage(hint.text), 160);
    };

    const handleChip = (chip) => {
        if (chip.special === 'search') {
            setInput('Find meetings about ');
            inputRef.current?.focus();
            return;
        }
        if (chip.special === 'doc') {
            fileRef.current?.click();
            return;
        }
        sendMessage(chip.text);
    };

    // ── File attachment — show choices instead of auto-processing ──
    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setDocFile(file);
        // Show the 2-option prompt (no API call yet)
        pushMsg({
            role: 'assistant',
            content: `I've received **${file.name}**. What would you like to do?`,
            type: 'doc_action',
            docFileName: file.name,
        });
    };

    // ── Action dispatcher for interactive message components ──
    const handleAction = async (action) => {

        // ── Doc: Ask questions ──
        if (action.type === 'doc_action' && action.choice === 'ask') {
            pushMsg({ role: 'user', content: '💬 Ask questions about this document', type: 'text' });
            setLoading(true);
            try {
                const form = new FormData();
                form.append('file', docFile);
                const res = await api.post('/api/chat/extract-text', form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                setDocText(res.data.text || '');
                pushMsg({
                    role: 'assistant',
                    content: `Document loaded! Go ahead — ask me anything about **${action.fileName}** and I'll answer based on its content.`,
                    type: 'text',
                });
            } catch (err) {
                pushMsg({ role: 'assistant', content: 'Could not load the document for Q&A. Make sure the backend is running on port 5000.', type: 'text' });
            } finally {
                setLoading(false);
            }
        }

        // ── Doc: Generate full insights on Meeting Page ──
        else if (action.type === 'doc_action' && action.choice === 'insights') {
            pushMsg({ role: 'user', content: '🔍 Generate full insights on Meeting Page', type: 'text' });
            pushMsg({
                role: 'assistant',
                content: '',
                type: 'insight_confirm',
                docFileName: action.fileName,
            });
        }

        // ── Confirm redirect to Meeting Page ──
        else if (action.type === 'confirm_insights') {
            if (!docFile) return;
            // Derive a friendly title from the filename
            const title = docFile.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            setPendingFile(docFile);
            setPendingTitle(title);
            setOpen(false);
            navigate('/meeting');
        }

        // ── Cancel insights redirect ──
        else if (action.type === 'cancel_insights') {
            pushMsg({ role: 'assistant', content: 'No problem! Is there anything else I can help you with?', type: 'text' });
        }

        // ── Meeting Q&A: user confirmed meeting selection ──
        else if (action.type === 'confirm_meetings') {
            const titles = action.meetings.map(m => m.title).join(', ');
            setMeetingQAContext(action.meetings);
            pushMsg({
                role: 'assistant',
                content: `I'm now in Q&A mode for: **${titles}**.\n\nAsk me anything about ${action.meetings.length > 1 ? 'these meetings' : 'this meeting'}!`,
                type: 'text',
            });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const autoResize = (e) => {
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        setInput(el.value);
    };

    const clearChat = () => {
        api.delete(`/api/chat/history?userName=${encodeURIComponent(userName)}`).catch(() => {});
        setMessages([{ role: 'assistant', content: WELCOME, type: 'text', isWelcome: true }]);
        setDocFile(null);
        setDocText('');
        setMeetingQAContext(null);
    };

    return (
        <>
            {/* ── FAB + Hint Bubbles wrapper ── */}
            <div
                className="ca-fab-wrapper"
                onMouseEnter={() => setFabHovered(true)}
                onMouseLeave={() => setFabHovered(false)}
            >
                {/* Hint bubbles — only when chat is closed and FAB is hovered */}
                {!open && fabHovered && (
                    <div className="ca-fab-hints" aria-hidden="true">
                        {FAB_HINTS.map((h, i) => (
                            <button key={i} className="ca-fab-hint" onClick={() => handleHintClick(h)}>
                                {h.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Floating Action Button */}
                <button
                    className={`ca-fab${open ? ' ca-fab-open' : ''}`}
                    onClick={() => setOpen(v => !v)}
                    aria-label="Toggle AI assistant"
                >
                    <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span className="ca-fab-badge">AI</span>
                    </>
                </button>
            </div>

            {/* ── Backdrop ── */}
            <div className={`ca-backdrop${open ? ' ca-backdrop-visible' : ''}`} onClick={() => setOpen(false)} />

            {/* ── Slide-in Panel ── */}
            <div className={`ca-panel${open ? ' ca-panel-open' : ''}`} role="dialog" aria-label="FirstMeet AI Assistant">

                {/* Header */}
                <div className="ca-header">
                    <div className="ca-header-left">
                        <div className="ca-header-avatar">AI</div>
                        <div>
                            <div className="ca-header-title">FirstMeet AI</div>
                            <div className="ca-header-sub">
                                <span className="ca-online-dot" />
                                Always on
                            </div>
                        </div>
                    </div>
                    <div className="ca-header-actions">
                        <button type="button" className="ca-icon-btn" onClick={clearChat} title="Clear conversation">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        <button type="button" className="ca-icon-btn" onClick={() => setOpen(false)} title="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Quick Action Chips */}
                <div className="ca-chips-row">
                    {CHIPS.map((chip, i) => (
                        <button key={i} className="ca-chip" onClick={() => handleChip(chip)}>
                            {chip.label}
                        </button>
                    ))}
                </div>

                {/* Messages */}
                <div className="ca-messages" ref={messagesRef}>
                    {/* Q&A context banner */}
                    {(docTextContent || meetingQAContext) && (
                        <div className="ca-qa-banner">
                            <span>
                                {docTextContent
                                    ? '📄 Document Q&A active'
                                    : `🗣️ Meeting Q&A: ${meetingQAContext.map(m => m.title).join(', ')}`
                                }
                            </span>
                            <button
                                type="button"
                                className="ca-qa-exit"
                                onClick={() => { setDocText(''); setMeetingQAContext(null); }}
                                title="Exit Q&A mode"
                            >
                                Exit Q&A ×
                            </button>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <MessageBubble
                            key={i}
                            msg={msg}
                            onNav={handleNav}
                            onAction={handleAction}
                            isLastMsg={i === messages.length - 1}
                        />
                    ))}

                    {loading && (
                        <div className="ca-msg-row bot">
                            <div className="ca-avatar">AI</div>
                            <div className="ca-bubble bot-bubble ca-typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="ca-input-area">
                    <button
                        className="ca-icon-btn attach"
                        onClick={() => fileRef.current?.click()}
                        title="Attach .txt or .docx file"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                    </button>
                    <textarea
                        ref={inputRef}
                        className="ca-input"
                        value={input}
                        onChange={autoResize}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything…"
                        rows={1}
                        disabled={loading}
                    />
                    <button
                        className={`ca-send-btn${(!input.trim() || loading) ? ' disabled' : ''}`}
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    </button>
                </div>

                <div className="ca-input-hint">Enter to send · Shift+Enter for new line · 📎 attach docs</div>
            </div>

            <input
                ref={fileRef}
                type="file"
                accept=".txt,.docx"
                style={{ display: 'none' }}
                onChange={handleFile}
            />
        </>
    );
};

export default ChatAgent;
