import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

const SignUpPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState('employee');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/api/users/signUp', { email, password, firstName, lastName, role });
            if (response.status === 201) {
                alert("User registered successfully!");
                navigate('/signin');
            } else {
                alert("Signup failed: " + (response.data.message || "Unknown error"));
            }
        } catch (error) {
            console.error("Error signing up:", error);
            alert("An error occurred during sign up: " + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card glass-card">
                <header className="auth-header">
                    <span className="auth-logo">MeetUp ⚡</span>
                    <h1 className="auth-title">Create account</h1>
                    <p className="auth-subtitle">Join MeetUp to start generating minutes</p>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="label-main" htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            className="input-field"
                            placeholder=""
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                            <label className="label-main" htmlFor="firstName">First Name</label>
                            <input
                                type="text"
                                id="firstName"
                                className="input-field"
                                placeholder=""
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="label-main" htmlFor="lastName">Last Name</label>
                            <input
                                type="text"
                                id="lastName"
                                className="input-field"
                                placeholder=""
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="label-main" htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            className="input-field"
                            placeholder=""
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength="6"
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label className="label-main" htmlFor="role">Role</label>
                        <select
                            id="role"
                            className="input-field"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                        >
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="btn-primary">
                        Sign Up
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Already have an account? <Link to="/signin" style={{ color: 'var(--accent-color)', fontWeight: '600' }}>Sign In</Link>
                </p>
            </div>
        </div>
    );
};

export default SignUpPage;