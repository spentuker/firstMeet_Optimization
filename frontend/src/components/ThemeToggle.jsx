import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
        >
            <span style={{ fontSize: '0.95rem' }}>{isDark ? '☀️' : '🌙'}</span>
            <div className="toggle-track">
                <div className="toggle-thumb" />
            </div>
            <span>{isDark ? 'Light' : 'Dark'}</span>
        </button>
    );
};

export default ThemeToggle;
