import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../pages/AdminLog.css"; 
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";

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
      const userType = localStorage.getItem("userType");
      const email = localStorage.getItem("userEmail");

      if (userType && email) {
        if (userType === "admin") {
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
      const res = await fetch("http://localhost:5001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Save session info
        localStorage.setItem("userType", data.userType);
        localStorage.setItem("userEmail", data.user.email);

        // Optional: fetch last login time for admins
        if (data.userType === "admin") {
          const logRes = await fetch(
            `http://localhost:5001/api/employeelogs?email=${data.user.email}&role=admin`
          );
          if (logRes.ok) {
            const logs = await logRes.json();
            if (logs.length > 0) {
              setLastLogin(logs[logs.length - 1].loginAt);
            }
          }
        }

        // Navigate based on user type
        if (data.userType === "admin") {
          navigate("/adminpanel");
        } else if (data.userType === "staff") {
          navigate("/landingmain");
        }
      } else {
        showToast(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("Server error. Please try again later.");
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
