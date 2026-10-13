import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../pages/AdminLog.css"; 
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import { apiRequest } from "../api";

const Toast = ({ message, onClose }) => (
  <div className="toast">
    {message}
    <span className="toast-close" onClick={onClose}>×</span>
  </div>
);

export default function AdminLog() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastLogin, setLastLogin] = useState(null);
  const navigate = useNavigate();

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // ✅ Check existing session
  useEffect(() => {
    const verifySession = async () => {
      let currentUser;
      try {
        currentUser = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
      } catch (error) {
        localStorage.removeItem('user_currentUser');
      }
      const userType = currentUser?.role;

      if (localStorage.getItem('user_token') && currentUser) {
        if (userType === "admin" || userType === "manager") {
          navigate("/adminpanel");
        } else if (userType === "staff") {
          navigate("/landingmain");
        }
      }
      setLoading(false);
    };

    verifySession();
  }, [navigate]);

  // ✅ Handle Login
  const handleLogin = async () => {
    if (!email || !password) {
      showToast("⚠️ Please enter both email and password!");
      return;
    }

    try {
      const { ok, data } = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (ok) {
        const payload = data?.payload || {};
        const user = payload.user || {};
        const role = user.role || 'customer';

        if (!['admin', 'manager'].includes(role)) {
          showToast('This employee login is limited to admin and manager accounts.');
          return;
        }

        localStorage.setItem('userType', role);
        localStorage.setItem('userEmail', user.email || email);
        localStorage.setItem('user_token', payload.token || '');
        localStorage.setItem('user_currentUser', JSON.stringify(user));
        localStorage.setItem('user_isLoggedIn', 'true');

        navigate('/adminpanel');
      } else {
        showToast(`❌ ${data?.message || 'Login failed'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Server error. Please try again later.');
    }
  };

  // ✅ Loading screen
  if (loading) {
    return (
      <div className="landing" style={{ backgroundImage: `url(${bg})` }}>
        <p style={{ textAlign: "center", marginTop: "30%", color: "white" }}>
          Checking session...
        </p>
      </div>
    );
  }

  return (
   <div className="landing adminlog-container" style={{ backgroundImage: `url(${bg})` }}>
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg("")} />}

  <div className="adminlog-container">
<img src={logo} alt="Logo" className="adminlog-logo fade-in" />


<div className="signup-flower-container right-flower">
  <img
    src={require("../assets/flower.png")}
    alt="Flower Right"
    className="signup-flower-img fade-in"
  />
</div>


        <div className="subframe-container">
          <img
            src={require("../assets/subframe.png")}
            alt="Subframe Design"
            className="subframe-img"
          />
          <div className="login-card">
            <h2>Employee Login</h2>

            {lastLogin && (
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                Last login: {new Date(lastLogin).toLocaleString()}
              </p>
            )}

            <div className="input-box">
              <label>Email</label>
              <input
                type="text"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-box">
              <label>Password</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <img
                src={require("../assets/showpassword.png")}
                alt="Show Password"
                className={`toggle-password ${showPassword ? "hidden" : ""}`}
                onClick={() => setShowPassword(!showPassword)}
              />
              <img
                src={require("../assets/hidepassword.png")}
                alt="Hide Password"
                className={`toggle-password ${showPassword ? "" : "hidden"}`}
                onClick={() => setShowPassword(!showPassword)}
              />
            </div>

            <button className="login-btn" onClick={handleLogin}>
              Log In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
