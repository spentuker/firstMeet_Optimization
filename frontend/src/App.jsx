import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/HomePage';
import MeetingPage from './pages/MeetingPage';
import JiraPage from './pages/JiraPage';
import CompletedTasksPage from './pages/CompletedTasksPage';
import EmailPage from './pages/EmailPage';
import DashboardPage from './pages/DashboardPage';
import ChatAgent from './components/ChatAgent.jsx';
import { ThemeProvider } from './context/ThemeContext';
import { PendingFileProvider } from './context/PendingFileContext';
import { ChatMeetingProvider } from './context/ChatMeetingContext';
import './App.css';

// Page transition wrapper — fades/slides on route change
function AnimatedRoutes() {
  const location = useLocation();
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    // Clear the transform after animation so position:fixed children
    // (e.g. sidebar) remain anchored to the viewport, not this div.
    const cleanup = setTimeout(() => {
      if (!el) return;
      el.style.transform = '';
      el.style.transition = '';
    }, 380);
    return () => { cancelAnimationFrame(raf); clearTimeout(cleanup); };
  }, [location.pathname]);

  return (
    <>
      <div ref={containerRef} style={{ minHeight: '100vh' }}>
        <Routes location={location}>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/meeting" element={<MeetingPage />} />
          <Route path="/completed" element={<CompletedTasksPage />} />
          <Route path="/jira" element={<JiraPage />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/analytics" element={<DashboardPage />} />
          <Route path="/" element={<Navigate to="/signin" replace />} />
        </Routes>
      </div>
      {/* ChatAgent lives OUTSIDE the route container so it never unmounts on navigation */}
      <ChatAgent />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <PendingFileProvider>
        <ChatMeetingProvider>
          <Router>
            <AnimatedRoutes />
          </Router>
        </ChatMeetingProvider>
      </PendingFileProvider>
    </ThemeProvider>
  );
}

export default App;