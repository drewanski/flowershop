import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";
import { apiRequest } from "../api";
import { auth, provider } from "../firebase/firebase";
import { signInWithPopup } from "firebase/auth";

const Toast = ({ message, onClose }) => (
  <div className="toast">
    {message}
    <span className="toast-close" onClick={onClose}>×</span>
  </div>
);

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const passwordRef = useRef(null);
  const navigate = useNavigate();

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
  const savedUsers = JSON.parse(localStorage.getItem("rememberedUsers")) || [];
  setSuggestedUsers(savedUsers);

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
  navigate(currentUser.role === 'admin' || currentUser.role === 'manager' ? '/adminpanel' : '/userinfo');
}
}, []);

// ---------------- Manual Email/Password Login ----------------
const handleLogin = async () => {
  if (!email || !password) {
    showToast("⚠️ Please enter both email and password!");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("⚠️ Please enter a valid email!");
    return;
  }
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
    if (!['customer', 'admin', 'manager'].includes(user.role)) {
      return showToast('This account does not have access to a customer or management page.');
    }

    localStorage.setItem('user_token', token);
    localStorage.setItem('user_currentUser', JSON.stringify(user));
    localStorage.setItem('user_isLoggedIn', 'true');
    localStorage.setItem('userType', user.role || 'customer');
    localStorage.setItem('userEmail', user.email || email);
    navigate(user.role === 'admin' || user.role === 'manager' ? '/adminpanel' : '/userinfo');
  } catch (err) {
    showToast('Login error: ' + err.message);
  }
};



// ---------------- Google Login ----------------
const handleGoogleLogin = async () => {
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
    if (!['customer', 'admin', 'manager'].includes(user.role)) {
      return showToast('This account does not have access to a customer or management page.');
    }
    localStorage.setItem('user_token', token);
    localStorage.setItem('user_currentUser', JSON.stringify(user));
    localStorage.setItem('user_isLoggedIn', 'true');
    localStorage.setItem('userType', user.role || 'customer');
    localStorage.setItem('userEmail', user.email || credential.user.email);
    navigate(user.role === 'admin' || user.role === 'manager' ? '/adminpanel' : '/userinfo');
  } catch (error) {
    console.error('Google sign-in error:', error);
    showToast(error.message || 'Google sign-in failed.');
  }
};


  return (
    <div className="landing" style={{ backgroundImage: `url(${bg})` }}>
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg("")} />}
          
  <div className="fade-in">
      <nav className="login-navbar">
  <img src={logo} alt="Sampaguita Logo" className="login-logo" />
  <ul className="landing-nav-links">
    <li>
      <Link to="/landingmain" className="landingmain-link">HOME</Link>
    </li>
    <li>
      <a href="#" className="landingmain-link">SHOP HERE</a>
    </li>
    <li>
     <Link to="/#about">ABOUT US</Link>
    </li>
    <li>
      <a href="#contact" className="landingmain-link">CONTACT</a>
    </li>
    <li><Link to="/account" className="signup-link-nav">ACCOUNT</Link></li>
  </ul>
</nav>

<div className="landingmain-navbar-icons1">
  <img src={cartIcon} alt="Cart" className="navbar-icon" />
  <img src={accountIcon} alt="Account" className="navbar-icon" />
</div>

   <div className="signup-flower-container">
  <img
    src={require("../assets/flower.png")}
    alt="Flower"
    className="signup-flower-img fade-in"
  />
</div>
      <div className="subframe-container">
        <img src={require("../assets/subframe.png")} alt="Subframe Design" className="subframe-img" />
        <div className="login-card">
          <h2>Log in</h2>
          <div className="login-fields">
  {/* Email */}
<div className="input-box">
  <label htmlFor="username">Email Address</label>
  <input
    list="userSuggestions"
    type="text"
    id="username"
    placeholder="Email Address"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  <datalist id="userSuggestions">
    {suggestedUsers.map((user, index) => (
      <option key={index} value={user} />
    ))}
  </datalist>
</div>

{/* Password */}
<div className="input-box">
  <label htmlFor="password">Password</label>
  <input
    ref={passwordRef}
    type={showPassword ? "text" : "password"}
    id="password"
    placeholder="Password"
    maxLength="16"
    required
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />
  <img
    src={require("../assets/showpassword.png")}
    alt="Show Password"
    className={`toggle-password ${showPassword ? "hidden" : ""}`}
    onClick={togglePasswordVisibility}
  />
  <img
    src={require("../assets/hidepassword.png")}
    alt="Hide Password"
    className={`toggle-password ${showPassword ? "" : "hidden"}`}
    onClick={togglePasswordVisibility}
  />
</div>

{/* Remember Me + Forgot Password */}
<div className="options">
  <label>
    <input
      type="checkbox"
      checked={rememberMe}
      onChange={(e) => setRememberMe(e.target.checked)}
    />{" "}
    Remember Me
  </label>
  <a href="#">Forgot Password?</a>
</div>
          </div>

          {/* Email login button */}
          <button className="login-btn" onClick={handleLogin}>Log In</button>

          <div className="divider">Or</div>

          {/* Sign up link */}
          <p className="signup-text">
  Don’t have an account?{" "}
  <Link to="/signup" className="signup-link">Create Account</Link>
</p>


          {/* Google login button */}
          <button className="image-btn" onClick={handleGoogleLogin}>
            <img src={require("../assets/signinwith.png")} alt="Google Login" />
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
