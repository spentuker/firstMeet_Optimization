import { useState, useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

const GoogleCalendarWidget = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const tokenClientRef = useRef(null);
    const accessTokenRef = useRef(null);

    useEffect(() => {
        if (!CLIENT_ID) return;
        const existing = document.querySelector('script[data-gis]');
        if (existing) {
            initTokenClient();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.dataset.gis = 'true';
        script.async = true;
        script.defer = true;
        script.onload = initTokenClient;
        document.head.appendChild(script);
    }, []);

    const initTokenClient = () => {
        if (!window.google) return;
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: async (tokenResponse) => {
                if (tokenResponse.error) { setError('Authorization failed. Please try again.'); return; }
                accessTokenRef.current = tokenResponse.access_token;
                setIsConnected(true);
                await fetchEvents(tokenResponse.access_token);
            },
        });
    };

    const fetchEvents = async (token) => {
        setLoading(true);
        setError('');
        try {
            const now = new Date().toISOString();
            const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
            const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(future)}&orderBy=startTime&singleEvents=true&maxResults=6`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            setEvents(data.items || []);
        } catch (err) {
            setError('Could not load calendar events.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (event) => {
        if (event.start?.dateTime) {
            return new Date(event.start.dateTime).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
            });
        }
        return new Date(event.start?.date).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
        });
    };

    const getCountdown = (event) => {
        const start = event.start?.dateTime || event.start?.date;
        const diff = new Date(start) - new Date();
        const hours = Math.floor(diff / 3_600_000);
        if (diff < 0) return 'Ongoing';
        if (hours < 1) return 'Starting soon!';
        if (hours < 24) return `In ${hours}h`;
        const days = Math.floor(diff / 86_400_000);
        if (days === 1) return 'Tomorrow';
        return `In ${days} days`;
    };

    /* ── No client ID configured ── */
    if (!CLIENT_ID) {
        return (
            <div className="chart-card calendar-widget no-config">
                <h3>📅 Google Calendar</h3>
                <div className="cal-setup-msg">
                    <p>Add your Google OAuth Client ID to enable calendar sync.</p>
                    <code>VITE_GOOGLE_CLIENT_ID=your_client_id</code>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                        Create one at{' '}
                        <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>
                            console.cloud.google.com
                        </a>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="chart-card calendar-widget">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <h3 style={{ margin: 0 }}>📅 Upcoming Meetings</h3>
                {isConnected && !loading && (
                    <button className="cal-refresh-btn" onClick={() => fetchEvents(accessTokenRef.current)}>↻ Refresh</button>
                )}
            </div>

            {!isConnected ? (
                <div className="cal-connect">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Connect Google Calendar to see your upcoming events here.
                    </p>
                    <button className="btn-primary cal-connect-btn" onClick={() => tokenClientRef.current?.requestAccessToken()}>
                        Connect Google Calendar
                    </button>
                </div>
            ) : loading ? (
                <div className="cal-loading">
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                </div>
            ) : error ? (
                <p style={{ color: '#f43f5e', fontSize: '0.875rem' }}>{error}</p>
            ) : events.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No events in the next 14 days. Enjoy the break! 🎉</p>
            ) : (
                <div className="cal-events">
                    {events.map(event => (
                        <div key={event.id} className="cal-event-item">
                            <div className="cal-event-info">
                                <span className="cal-event-title">{event.summary || '(No title)'}</span>
                                <span className="cal-event-time">{formatTime(event)}</span>
                            </div>
                            <span className="cal-event-badge">{getCountdown(event)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GoogleCalendarWidget;
