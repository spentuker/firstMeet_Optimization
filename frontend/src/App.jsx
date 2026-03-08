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
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
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
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  return (
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
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <ThemeToggle />
        <AnimatedRoutes />
      </Router>
    </ThemeProvider>
  );
}

export default App;