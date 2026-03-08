import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { rootApi } from '../api';
import '../styles/signInPage.css';


const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwvCC+/XfLWlOHjQG2i1h
j9vYJQnsebFCs06oNNSmJjx2RQ1URgDKW2VSZ6RZfBn2trjRLT3UoLzyYaJ/+PsU
P2DwPsYW+O1b9UO+uIklPbb46n2md6mC5baP83/zDajJYzDU5qBheElQAlmT3MZ2
KfDqKb4+0nXlX2O+k/920ywdGv8az4ugomMzxcf87EkOPUDzw5Eib87SZjp8eHkg
vX6rC00AiJne2oKfSA1jqoeaEDStpyUv3UcTltY3FdLj/3tdNFNbHn3WqGMtNCbM
Zb/qIqlS43tLWpCj1mcSvWfH0KJN7ju59tS7vaSGKmLO3BIxWFCrJODhirbfNtIT
BQIDAQAB
-----END PUBLIC KEY-----`;


function pemToArrayBuffer(pem) {
    const b64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s+/g, '');
    const binary = atob(b64);
    const len = binary.length;
    const buf = new ArrayBuffer(len);
    const view = new Uint8Array(buf);
    for (let i = 0; i < len; i++) {
        view[i] = binary.charCodeAt(i);
    }
    return buf;
}

async function encryptPassword(password) {
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
        'spki',
        pemToArrayBuffer(PUBLIC_KEY_PEM),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    );
    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        key,
        enc.encode(password)
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}


const SignInPage = () => {
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const encryptedPassword = await encryptPassword(password);
            const response = await rootApi.post('/signIn', { userName, password: encryptedPassword });
            if (response.data.success) {
                localStorage.setItem('userName', response.data.userName);
                localStorage.setItem('userRole', response.data.role);
                navigate('/analytics');
            } else {
                alert("Sign in failed: " + (response.data.message || "Unknown error"));
            }
        } catch (error) {
            console.error("Error signing in:", error);
            alert("An error occurred during sign in.");
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card glass-card">
                <header className="auth-header">
                    <span className="auth-logo">MeetUp ⚡</span>
                    <h1 className="auth-title">Welcome back</h1>
                    <p className="auth-subtitle">Sign in to your account</p>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="label-main" htmlFor="userName">Username</label>
                        <input
                            type="text"
                            id="userName"
                            className="input-field"
                            placeholder="Enter your username"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label className="label-main" htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary">
                        Sign In →
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Don't have an account?{' '}
                    <Link to="/signup" style={{ color: 'var(--accent-color)', fontWeight: '600' }}>
                        Sign Up
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default SignInPage;

