import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/HomePage';
import MeetingPage from './pages/MeetingPage';
import JiraPage from './pages/JiraPage';
import CompletedTasksPage from './pages/CompletedTasksPage';
import EmailPage from './pages/EmailPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
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
    </Router>
  );
}

export default App;