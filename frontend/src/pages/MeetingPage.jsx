import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';
import MainLayout from '../components/MainLayout';
import { usePendingFile } from '../context/PendingFileContext';
import { useChatMeeting } from '../context/ChatMeetingContext';
import RecapEmailModal from '../components/RecapEmailModal';
import '../styles/homePage.css';

const MeetingPage = () => {
    const [meetingTitle, setMeetingTitle] = useState('');
    const [file, setFile] = useState(null);
    const [summary, setSummary] = useState('');
    const [actionItems, setActionItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // ── Recording state ──
    const [isRecording, setIsRecording]       = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [recordingError, setRecordingError] = useState('');
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [manualTranscript, setManualTranscript] = useState('');
    const [showManual, setShowManual]             = useState(false);
    const recognitionRef     = useRef(null);
    const timerRef           = useRef(null);
    const finalTranscriptRef = useRef('');
    const retryCountRef      = useRef(0);
    const isStoppingRef      = useRef(false);

    // ── Meeting history + notepad state ──
    const [meetingHistory, setMeetingHistory]     = useState([]);
    const [selectedMeeting, setSelectedMeeting]   = useState(null);
    const [noteContent, setNoteContent]           = useState('');
    const [notePreview, setNotePreview]           = useState(false);
    const [noteSaving, setNoteSaving]             = useState(false);
    const [noteSaved, setNoteSaved]               = useState(false);
    const noteSaveTimer                           = useRef(null);
    const userName = localStorage.getItem('userName');
    const { pendingFile, setPendingFile, pendingTitle } = usePendingFile();
    const { setPendingMeetings } = useChatMeeting();

    // Meeting history multi-select + recap state
    const [selectMode, setSelectMode]           = useState(false);
    const [selectedIds, setSelectedIds]         = useState(new Set());
    const [showRecap, setShowRecap]             = useState(false);
    const [recapMeetingId, setRecapMeetingId]   = useState(null);
    const [savedMeetingId, setSavedMeetingId]   = useState(null);

    // Auto-trigger if a file was handed off from the ChatAgent
    useEffect(() => {
        if (!pendingFile) return;
        const f = pendingFile;
        setPendingFile(null);           // consume immediately so it doesn't re-trigger
        setFile(f);
        if (pendingTitle) setMeetingTitle(pendingTitle);
        // Small delay to ensure state is settled before triggering submit
        setTimeout(() => onSubmit(f), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch meeting history on mount
    useEffect(() => {
        if (!userName) return;
        api.get(`/api/meetings/${encodeURIComponent(userName)}`)
            .then(res => setMeetingHistory(res.data || []))
            .catch(() => {});
    }, [userName]);

    // Open a meeting and load its personal note
    const openMeeting = useCallback(async (meeting) => {
        setSelectedMeeting(meeting);
        setNotePreview(false);
        setNoteSaved(false);
        try {
            const res = await api.get(`/api/meetings/${meeting._id}/notes?userName=${encodeURIComponent(userName)}`);
            setNoteContent(res.data.content || '');
        } catch {
            setNoteContent('');
        }
    }, [userName]);

    const closeMeetingModal = () => {
        setSelectedMeeting(null);
        setNoteContent('');
        setNotePreview(false);
    };

    // Auto-save with 800ms debounce
    const handleNoteChange = (val) => {
        setNoteContent(val);
        setNoteSaved(false);
        clearTimeout(noteSaveTimer.current);
        noteSaveTimer.current = setTimeout(async () => {
            if (!selectedMeeting) return;
            setNoteSaving(true);
            try {
                await api.put(`/api/meetings/${selectedMeeting._id}/notes`, { userName, content: val });
                setNoteSaved(true);
                // Refresh history to update hasNote flag
                const res = await api.get(`/api/meetings/${encodeURIComponent(userName)}`);
                setMeetingHistory(res.data || []);
            } catch {}
            setNoteSaving(false);
        }, 800);
    };

    const onSubmit = async (fileOverride = null) => {
        const activeFile = fileOverride || file;
        if (!activeFile) {
            alert("Please upload a transcript file or use the recorder below.");
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
        formData.append("file", activeFile);
        formData.append("prompt", prompt);

        try {
            const response = await api.post("/ask", formData, {
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
                        const res = await api.post('/api/tasks', {
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
                    const savedMeeting = await api.post('/api/meetings', {
                        title: meetingTitle || "Untitled Meeting",
                        userName,
                        summary: summaryText.trim(),
                        actionItems: finalItems,
                    });
                    setSavedMeetingId(savedMeeting.data._id);
                    // Refresh history list
                    const histRes = await api.get(`/api/meetings/${encodeURIComponent(userName)}`);
                    setMeetingHistory(histRes.data || []);
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
            await api.patch(`/api/tasks/assign/${item._id}`, {
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
                await api.delete(`/api/tasks/${item._id}`);
            } catch (err) {
                console.error("Failed to delete task from DB:", err);
            }
        }
        setActionItems(prev => prev.filter((_, i) => i !== index));
    };

    // ── Recording functions ──
    const startRecording = () => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            setRecordingError('');
            setShowManual(true);
            return;
        }
        retryCountRef.current  = 0;
        isStoppingRef.current  = false;
        finalTranscriptRef.current = '';
        setIsRecording(true);
        setLiveTranscript('');
        setRecordingError('');
        setShowManual(false);
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);

        const launch = () => {
            const recognition = new SpeechRec();
            recognition.continuous     = true;
            recognition.interimResults = true;
            recognition.lang           = 'en-US';

            recognition.onresult = (event) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscriptRef.current += event.results[i][0].transcript + ' ';
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }
                setLiveTranscript(finalTranscriptRef.current + interim);
            };

            recognition.onerror = (e) => {
                if (e.error === 'network' || e.error === 'no-speech') return; // handled in onend
                const msgs = {
                    'not-allowed':         '🎤 Microphone access denied — allow it in browser settings.',
                    'audio-capture':       '🎤 No microphone detected. Please connect one.',
                    'service-not-allowed': 'Speech service not permitted on this page.',
                };
                setRecordingError(msgs[e.error] || `Recognition error: ${e.error}`);
                isStoppingRef.current = true;
            };

            recognition.onend = () => {
                if (isStoppingRef.current) {
                    setIsRecording(false);
                    clearInterval(timerRef.current);
                } else if (retryCountRef.current < 2) {
                    // Retry up to 2 times silently
                    retryCountRef.current++;
                    setTimeout(() => {
                        if (!isStoppingRef.current) recognitionRef.current = launch();
                    }, 1000);
                } else {
                    // Fall back to manual textarea
                    setIsRecording(false);
                    clearInterval(timerRef.current);
                    setShowManual(true);
                    setRecordingError('');
                }
            };

            try { recognition.start(); } catch {}
            return recognition;
        };

        recognitionRef.current = launch();
    };

    const stopRecording = () => {
        isStoppingRef.current = true;
        if (recognitionRef.current) recognitionRef.current.stop();
        clearInterval(timerRef.current);
        setIsRecording(false);
    };

    const analyzeManual = async () => {
        const text = manualTranscript.trim();
        if (!text) { alert('Please type or paste your meeting transcript first.'); return; }
        const blob = new Blob([text], { type: 'text/plain' });
        const f    = new File([blob], 'manual-transcript.txt', { type: 'text/plain' });
        setManualTranscript('');
        setShowManual(false);
        await onSubmit(f);
    };

    const analyzeRecording = async () => {
        const text = (finalTranscriptRef.current || liveTranscript).trim();
        if (!text) { alert('No transcript captured yet. Please speak during recording.'); return; }
        const blob = new Blob([text], { type: 'text/plain' });
        const transcriptFile = new File([blob], 'recording-transcript.txt', { type: 'text/plain' });
        await onSubmit(transcriptFile);
    };

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

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

                {/* ── Recording Section ── */}
                <div className="task-box glass-card recording-section">
                    <div className="recording-header">
                        <h3>🎤 Record Live Meeting</h3>
                        <p>Speak during your meeting — we'll transcribe and analyze it automatically.</p>
                    </div>

                    <div className="recording-controls">
                        {!isRecording ? (
                            <button className="btn-record" onClick={startRecording} disabled={loading}>
                                🎤 Start Recording
                            </button>
                        ) : (
                            <button className="btn-record active" onClick={stopRecording}>
                                ⏹ Stop&nbsp;&nbsp;<span className="rec-timer">{fmt(recordingSeconds)}</span>
                            </button>
                        )}

                        {!isRecording && !showManual && (
                            <button
                                type="button"
                                className="btn-record"
                                style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                                onClick={() => { setShowManual(true); setRecordingError(''); }}
                                disabled={loading}
                            >
                                ✍️ Type transcript instead
                            </button>
                        )}

                        {liveTranscript && !isRecording && (
                            <button
                                className="btn-primary"
                                onClick={analyzeRecording}
                                disabled={loading}
                                style={{ marginLeft: '0.75rem' }}
                            >
                                {loading ? 'Analyzing...' : '✨ Analyze Recording'}
                            </button>
                        )}
                    </div>

                    {isRecording && (
                        <div className="recording-live">
                            <span className="rec-dot" />
                            Recording in progress — speak clearly into your microphone
                        </div>
                    )}

                    {liveTranscript && (
                        <div className="transcript-box">
                            <label className="label-main">Live Transcript</label>
                            <div className="transcript-text">{liveTranscript}</div>
                        </div>
                    )}

                    {/* Manual transcript fallback */}
                    {showManual && (
                        <div className="transcript-box" style={{ marginTop: '1rem' }}>
                            <label className="label-main">📝 Paste or type your meeting transcript</label>
                            <textarea
                                className="input-field"
                                rows={8}
                                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.55', marginTop: '0.5rem' }}
                                placeholder="Paste your meeting transcript here, then click Analyze..."
                                value={manualTranscript}
                                onChange={(e) => setManualTranscript(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button className="btn-primary" onClick={analyzeManual} disabled={loading || !manualTranscript.trim()}>
                                    {loading ? 'Analyzing...' : '✨ Analyze Transcript'}
                                </button>
                                <button
                                    type="button"
                                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.82rem' }}
                                    onClick={() => { setShowManual(false); setManualTranscript(''); }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {recordingError && (
                        <p className="recording-error">⚠️ {recordingError}</p>
                    )}
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
                        {savedMeetingId && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    className="small-assign-btn"
                                    onClick={() => { setRecapMeetingId(savedMeetingId); setShowRecap(true); }}
                                >
                                    📧 Send Recap Email
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Meeting History ── */}
                {meetingHistory.length > 0 && (
                    <div className="task-box glass-card" style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                            <h3 style={{ color: 'var(--accent-color)', margin: 0 }}>📋 Meeting History</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {selectMode && selectedIds.size > 0 && (
                                    <button
                                        className="ask-ai-meetings-btn"
                                        onClick={() => {
                                            const chosen = meetingHistory.filter(m => selectedIds.has(m._id));
                                            setPendingMeetings(chosen);
                                            setSelectMode(false);
                                            setSelectedIds(new Set());
                                        }}
                                    >
                                        🤖 Ask AI about {selectedIds.size} →
                                    </button>
                                )}
                                <button
                                    className={`small-assign-btn${selectMode ? ' active-select-btn' : ''}`}
                                    onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
                                >
                                    {selectMode ? '✕ Cancel' : '☑ Select'}
                                </button>
                            </div>
                        </div>
                        <div className="meeting-history-list">
                            {meetingHistory.map(m => {
                                const isSelected = selectedIds.has(m._id);
                                return (
                                    <div
                                        key={m._id}
                                        className={`meeting-history-row${isSelected ? ' meeting-card-selected' : ''}`}
                                        onClick={() => {
                                            if (selectMode) {
                                                setSelectedIds(prev => {
                                                    const next = new Set(prev);
                                                    next.has(m._id) ? next.delete(m._id) : next.add(m._id);
                                                    return next;
                                                });
                                            } else {
                                                openMeeting(m);
                                            }
                                        }}
                                        role="button"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                            {selectMode && (
                                                <input
                                                    type="checkbox"
                                                    className="meeting-select-checkbox"
                                                    checked={isSelected}
                                                    readOnly
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="urgent-task-title" style={{ marginBottom: '0.2rem' }}>{m.title}</div>
                                                <div className="urgent-task-meta">
                                                    {(m.actionItems || []).length} action items · {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                        {!selectMode && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                                                {(m.notes || []).some(n => n.userName === userName && n.content?.trim()) && (
                                                    <span className="note-badge" title="Has your notes">📝</span>
                                                )}
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Open →</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Meeting Detail Modal ── */}
                {selectedMeeting && (
                    <div className="notepad-overlay" onClick={closeMeetingModal}>
                        <div className="notepad-modal" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="notepad-modal-header">
                                <div>
                                    <h2 className="notepad-modal-title">{selectedMeeting.title}</h2>
                                    <span className="urgent-task-meta">{new Date(selectedMeeting.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <button
                                        className="small-assign-btn"
                                        onClick={() => { setRecapMeetingId(selectedMeeting._id); setShowRecap(true); }}
                                    >
                                        📧 Send Recap
                                    </button>
                                    <button className="notepad-close-btn" onClick={closeMeetingModal}>✕</button>
                                </div>
                            </div>

                            {/* Two-column body */}
                            <div className="notepad-modal-body">
                                {/* Left: Summary + Action Items */}
                                <div className="notepad-summary-col">
                                    <h4 className="notepad-section-label">Summary</h4>
                                    <div className="notepad-summary-text">
                                        {selectedMeeting.summary || <span style={{ color: 'var(--text-muted)' }}>No summary recorded.</span>}
                                    </div>

                                    {(selectedMeeting.actionItems || []).length > 0 && (
                                        <>
                                            <h4 className="notepad-section-label" style={{ marginTop: '1.25rem' }}>Action Items</h4>
                                            <ul className="notepad-action-list">
                                                {selectedMeeting.actionItems.map((item, i) => (
                                                    <li key={i} className="notepad-action-item">
                                                        <span className="notepad-action-title">{item.title || item.task}</span>
                                                        {item.assignedTo && (
                                                            <span className="notepad-action-meta"> → {item.assignedTo}</span>
                                                        )}
                                                        {item.priority && (
                                                            <span className={`priority-tag ${(item.priority || '').toLowerCase()}`} style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
                                                                {item.priority}
                                                            </span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                </div>

                                {/* Right: Notepad */}
                                <div className="notepad-editor-col">
                                    <div className="notepad-editor-header">
                                        <h4 className="notepad-section-label" style={{ margin: 0 }}>My Notes</h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span className="notepad-save-status">
                                                {noteSaving ? '💾 Saving…' : noteSaved ? '✅ Saved' : ''}
                                            </span>
                                            <button
                                                className={`notepad-mode-btn${notePreview ? ' active' : ''}`}
                                                onClick={() => setNotePreview(!notePreview)}
                                            >
                                                {notePreview ? '✏️ Edit' : '👁 Preview'}
                                            </button>
                                        </div>
                                    </div>

                                    {notePreview ? (
                                        <div className="notepad-preview">
                                            {noteContent
                                                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
                                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing to preview yet.</span>
                                            }
                                        </div>
                                    ) : (
                                        <textarea
                                            className="notepad-textarea"
                                            value={noteContent}
                                            onChange={e => handleNoteChange(e.target.value)}
                                            placeholder={`Write your notes in Markdown…\n\n## Key Takeaways\n- \n\n## Follow-ups\n- `}
                                            spellCheck={false}
                                        />
                                    )}
                                    <p className="notepad-hint">Supports Markdown · Auto-saves · Private to you</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {showRecap && recapMeetingId && (
                <RecapEmailModal
                    meetingId={recapMeetingId}
                    onClose={() => { setShowRecap(false); setRecapMeetingId(null); }}
                />
            )}
        </MainLayout>
    );
};

export default MeetingPage;
