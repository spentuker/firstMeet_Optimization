import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

const RecapEmailModal = ({ meetingId, onClose }) => {
    const [loadingData, setLoadingData] = useState(true);
    const [subject, setSubject]         = useState('');
    const [body, setBody]               = useState('');
    const [recipients, setRecipients]   = useState([]);
    const [extraEmail, setExtraEmail]   = useState('');
    const [sending, setSending]         = useState(false);
    const [doneMsg, setDoneMsg]         = useState('');
    const [hasError, setHasError]       = useState(false);

    useEffect(() => {
        api.get(`/api/email/meeting-recap/${meetingId}`)
            .then(res => {
                setSubject(res.data.subject);
                setBody(res.data.body);
                setRecipients(res.data.recipients.map(r => ({ ...r, enabled: true })));
            })
            .catch(() => {
                setSubject('Meeting Recap');
                setBody('Could not load recap data. Please try again.');
            })
            .finally(() => setLoadingData(false));
    }, [meetingId]);

    const toggleRecipient = (i) =>
        setRecipients(prev => prev.map((r, idx) => idx === i ? { ...r, enabled: !r.enabled } : r));

    const updateEmail = (i, val) =>
        setRecipients(prev => prev.map((r, idx) => idx === i ? { ...r, email: val } : r));

    const addExtra = () => {
        const e = extraEmail.trim();
        if (!e || !e.includes('@')) return;
        setRecipients(prev => [
            ...prev,
            { userName: e, displayName: e, email: e, found: true, enabled: true },
        ]);
        setExtraEmail('');
    };

    const handleSend = async () => {
        const targets = recipients.filter(r => r.enabled && r.email?.includes('@'));
        if (!targets.length) return;
        setSending(true);
        const failed = [];
        let sent = 0;
        for (const r of targets) {
            try {
                await api.post('/api/email/send', {
                    to_email: r.email,
                    subject,
                    message: body,
                });
                sent++;
            } catch {
                failed.push(r.displayName || r.email);
            }
        }
        setHasError(failed.length > 0);
        setDoneMsg(
            `✅ Sent to ${sent} recipient${sent !== 1 ? 's' : ''}` +
            (failed.length ? ` · Failed: ${failed.join(', ')}` : '')
        );
        setSending(false);
    };

    const enabledCount = recipients.filter(r => r.enabled && r.email?.includes('@')).length;

    return createPortal(
        <div className="recap-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="recap-modal">
                {/* Header */}
                <div className="recap-header">
                    <div>
                        <h3 className="recap-title">Send Meeting Recap</h3>
                        <p className="recap-sub">Review and edit before sending</p>
                    </div>
                    <button type="button" className="recap-close" onClick={onClose}>✕</button>
                </div>

                {loadingData ? (
                    <div className="recap-loading">Loading recap data…</div>
                ) : (
                    <div className="recap-body">
                        {/* Subject */}
                        <div className="recap-field">
                            <label className="recap-label">Subject</label>
                            <input
                                className="recap-input"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                            />
                        </div>

                        {/* Body */}
                        <div className="recap-field">
                            <label className="recap-label">Email Body</label>
                            <textarea
                                className="recap-textarea"
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                rows={12}
                            />
                        </div>

                        {/* Recipients */}
                        <div className="recap-field">
                            <label className="recap-label">Recipients</label>
                            <div className="recap-recipients">
                                {recipients.length === 0 && (
                                    <div className="recap-empty-recip">
                                        No recipients found. Add emails below.
                                    </div>
                                )}
                                {recipients.map((r, i) => (
                                    <div
                                        key={i}
                                        className={`recap-recipient${r.enabled ? '' : ' recap-recipient-off'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="recap-check"
                                            checked={r.enabled}
                                            onChange={() => toggleRecipient(i)}
                                        />
                                        <span className="recap-rname">{r.displayName}</span>
                                        {r.found ? (
                                            <span className="recap-remail">{r.email}</span>
                                        ) : (
                                            <>
                                                <span className="recap-no-email">⚠️ No email</span>
                                                <input
                                                    type="email"
                                                    className="recap-email-input"
                                                    placeholder="Enter email…"
                                                    value={r.email}
                                                    onChange={e => updateEmail(i, e.target.value)}
                                                />
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Add external email */}
                                <div className="recap-add-row">
                                    <input
                                        type="email"
                                        className="recap-email-input"
                                        placeholder="Add external email address…"
                                        value={extraEmail}
                                        onChange={e => setExtraEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addExtra()}
                                    />
                                    <button type="button" className="recap-add-btn" onClick={addExtra}>
                                        + Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Result message */}
                        {doneMsg && (
                            <div className={`recap-done${hasError ? ' recap-done-warn' : ''}`}>
                                {doneMsg}
                            </div>
                        )}

                        {/* Send button */}
                        <button
                            type="button"
                            className="recap-send-btn"
                            onClick={handleSend}
                            disabled={sending || enabledCount === 0 || !!doneMsg}
                        >
                            {sending
                                ? 'Sending…'
                                : `Send to ${enabledCount} recipient${enabledCount !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default RecapEmailModal;
