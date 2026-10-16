import { saveSession } from '../shoppingSession';
import { roleHome, loginDestination } from '../roleAccess';
import StoreHeader from '../components/StoreHeader';
import './CoffeeShop.css';
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Login.css";
import { apiRequest } from "../api";
import { auth, provider } from "../firebase/firebase";
import { signInWithPopup } from "firebase/auth";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from;

  const navigateAfterLogin = (role) => {
    navigate(loginDestination(role, returnTo), { replace: true });
  };

  const saveRememberedEmail = (value) => {
    if (!rememberMe || !value) return;
    const current = Array.isArray(suggestedUsers) ? suggestedUsers : [];
    const normalized = value.trim();
    const updated = [normalized, ...current.filter((item) => item !== normalized)].slice(0, 5);
    localStorage.setItem('rememberedUsers', JSON.stringify(updated));
    setSuggestedUsers(updated);
  };

  const togglePasswordVisibility = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);

    if (passwordRef.current) {
      const cursorPos = passwordRef.current.selectionStart;
      passwordRef.current.focus();
      passwordRef.current.setSelectionRange(cursorPos, cursorPos);
    }
  };

  
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };


  const [rememberMe, setRememberMe] = useState(false);
const [suggestedUsers, setSuggestedUsers] = useState([]);

useEffect(() => {
  // Load remembered users
  let savedUsers = [];
  try { savedUsers = JSON.parse(localStorage.getItem("rememberedUsers") || '[]'); } catch (error) { localStorage.removeItem('rememberedUsers'); }
  setSuggestedUsers(savedUsers);
  if (['/cart', '/checkout'].includes(location.state?.from)) setToastMsg('Sign in to finish checkout. Your cart and delivery details are saved.');

  // Auto-login if user didn’t log out
let currentUser;
try {
  currentUser = JSON.parse(localStorage.getItem("user_currentUser") || 'null');
} catch (error) {
  localStorage.removeItem('user_currentUser');
}
const isLoggedIn = localStorage.getItem("user_isLoggedIn");
const hasToken = localStorage.getItem('user_token');
if (currentUser && isLoggedIn === "true" && hasToken) {
  navigateAfterLogin(currentUser.role);
}
}, []);

// ---------------- Manual Email/Password Login ----------------
const handleLogin = async () => {
  if (submitting) return;
  if (!email || !password) {
    showToast("⚠️ Please enter both email and password!");
    return;
  }

  setSubmitting(true);
  try {
    const { ok, data } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!ok) {
      return showToast(data?.message || 'Login failed');
    }

    const payload = data?.payload || {};
    const user = payload.user || {};
    const token = payload.token;

    if (!token) {
      return showToast('Login response was missing a token.');
    }
    if (roleHome(user.role) === '/login') {
      return showToast('This account does not have a supported role. Contact the shop administrator.');
    }

    saveSession(user, token);
    saveRememberedEmail(email);
    navigateAfterLogin(user.role);
  } catch (err) {
    showToast('Login error: ' + err.message);
  } finally { setSubmitting(false); }
};



// ---------------- Google Login ----------------
const handleGoogleLogin = async () => {
  if (submitting) return;
  setSubmitting(true);
  try {
    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();
    let result = await apiRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    if (result.status === 428) {
      const contactNumber = window.prompt('Enter your phone number to finish creating your account:');
      if (!contactNumber) return;
      result = await apiRequest('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken, contactNumber }),
      });
    }

    if (!result.ok) {
      throw new Error(result.data?.message || 'Google sign-in failed.');
    }

    const { user, token } = result.data.payload;
    if (roleHome(user.role) === '/login') {
      return showToast('This account does not have a supported role. Contact the shop administrator.');
    }
    saveSession(user, token);
    saveRememberedEmail(credential.user.email || email);
    navigateAfterLogin(user.role);
  } catch (error) {
    console.error('Google sign-in error:', error);
    showToast(error.message || 'Google sign-in failed.');
  } finally { setSubmitting(false); }
};


  return (
    <div className="coffee-site auth-login">
      <StoreHeader />
      {toastMsg && <div className="auth-login-notice" role="alert">{toastMsg}<button type="button" aria-label="Dismiss message" onClick={() => setToastMsg('')}>&#215;</button></div>}
      <main className="auth-login-layout">
        <section className="auth-login-story" aria-label="Your everyday coffee ritual">
          <img src="/images/products/latte.webp" alt="Freshly poured latte with delicate rosetta art" />
          <div className="auth-login-story-top"><span>Sampaguita</span><span>COFFEE, CONNECTION, EVERY DAY.</span></div>
          <div className="auth-login-story-copy"><p>YOUR DAILY MOMENT</p><h1>A familiar cup.<br />A warm welcome.</h1><p>Good coffee brings us together. Your next little pause starts here.</p><Link to="/shop">Explore our coffee <span aria-hidden="true">&#8599;</span></Link></div>
        </section>
        <section className="auth-login-panel" aria-labelledby="login-heading">
          <div className="auth-login-form-wrap">
            <p className="auth-login-eyebrow">WELCOME TO Sampaguita</p>
            <h2 id="login-heading">Welcome back.</h2>
            <p className="auth-login-intro">Sign in for your next coffee moment.</p>
            <form onSubmit={(event) => { event.preventDefault(); handleLogin(); }}>
              <div className="auth-login-field">
                <label htmlFor="username">Email, username, or phone number</label>
                <input list="userSuggestions" type="text" id="username" placeholder="Enter your account details" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <datalist id="userSuggestions">{suggestedUsers.map((user, index) => <option key={index} value={user} />)}</datalist>
              </div>
              <div className="auth-login-field">
                <label htmlFor="password">Password</label>
                <div className="auth-login-password"><input ref={passwordRef} type={showPassword ? 'text' : 'password'} id="password" placeholder="Enter your password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /><button type="button" onClick={togglePasswordVisibility} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
              </div>
              <div className="auth-login-options"><label><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />Remember me</label><Link to="/password-reset">Forgot password?</Link></div>
              <button className="auth-login-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Log In'}<span aria-hidden="true">&#8599;</span></button>
              <div className="auth-login-divider"><span>or continue with</span></div>
              <button className="auth-login-google" type="button" disabled={submitting} onClick={handleGoogleLogin} aria-label="Google Login"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.93A6 6 0 0 1 6.1 12c0-.67.12-1.32.31-1.93V7.48H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.52l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"/></svg>Google</button>
            </form>
            <p className="auth-login-signup">New around here? <Link to="/signup" state={{ from: returnTo }}>Create an account</Link></p>
            <p className="auth-login-team">One account. The right place.<br /><span>Customers and team members sign in here.</span></p>
          </div>
        </section>
      </main>
      <footer className="auth-login-footer"><span>Good coffee. Everyday moments.</span><span>&copy; {new Date().getFullYear()} Sampaguita</span></footer>
    </div>
  );
}
