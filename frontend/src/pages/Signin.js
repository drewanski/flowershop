import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Signin.css";
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";
import { apiRequest } from "../api";
import { auth, provider } from "../firebase/firebase";
import { signInWithPopup } from "firebase/auth";

const Toast = ({ message, onClose }) => (
  <div className="signup-toast">
    {message}
    <span className="signup-toast-close" onClick={onClose}>×</span>
  </div>
);

export default function SignUp() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [passwordStrengthLevel, setPasswordStrengthLevel] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [homeAddress, setHomeAddress] = useState("");

  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const navigate = useNavigate();

  const togglePasswordVisibility = (ref) => {
    setShowPassword((prev) => !prev);
    if (ref.current) {
      const cursorPos = ref.current.selectionStart;
      ref.current.focus();
      ref.current.setSelectionRange(cursorPos, cursorPos);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const checkPasswordStrength = (pwd) => {
    let level = 0;
    if (pwd.length > 0) level = 1;
    if (pwd.length >= 6) level = 2;
    if (pwd.length >= 8 && /[A-Z]/.test(pwd) && /\d/.test(pwd)) level = 3;
    setPasswordStrengthLevel(level);
  };

  // ---------------- Manual Sign-Up ----------------
const handleManualSignUp = async () => {
  if (!firstName || !lastName || !phoneNumber || !signUpEmail || !signUpPassword || !confirmPassword) {
    showToast("⚠️ Fill in all required fields!");
    return;
  }

  if (signUpPassword !== confirmPassword) {
    showToast("⚠️ Passwords do not match!");
    return;
  }

  try {
    const payload = {
      firstName,
      lastName,
      contactNumber: phoneNumber,
      homeAddress,
      username: `${(signUpEmail.split('@')[0] || `${firstName}${lastName}`).slice(0, 23)}${Math.floor(100000 + Math.random() * 900000)}`,
      email: signUpEmail,
      password: signUpPassword,
    };

    const { ok, data } = await apiRequest('/auth/register-customer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!ok) {
      throw new Error(data?.message || 'Unable to create account');
    }

    showToast('✅ Account created successfully!');
    navigate('/login');
  } catch (err) {
    console.error('Manual signup error:', err);
    showToast('⚠️ Unable to save account to database.');
  }
};

  // ---------------- Google Sign-Up ----------------
  const handleGoogleSignUp = async () => {
    if (!phoneNumber) {
      showToast('Enter your phone number before using Google sign-up.');
      return;
    }

    try {
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      const { ok, data } = await apiRequest('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken, contactNumber: phoneNumber, homeAddress }),
      });

      if (!ok) throw new Error(data?.message || 'Google sign-up failed.');

      const { user, token } = data.payload;
      localStorage.setItem('user_token', token);
      localStorage.setItem('user_currentUser', JSON.stringify(user));
      localStorage.setItem('user_isLoggedIn', 'true');
      localStorage.setItem('userType', user.role || 'customer');
      localStorage.setItem('userEmail', user.email || credential.user.email);
      navigate('/userinfo');
    } catch (error) {
      console.error('Google sign-up error:', error);
      showToast(error.message || 'Google sign-up failed.');
    }
  };

  return (
    <div className="signup-landing" style={{ backgroundImage: `url(${bg})` }}>
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg("")} />}

      <nav className="signup-navbar">
        <img src={logo} alt="Logo" className="signup-logo" />
        <ul className="landing-nav-links">
          <li><Link to="/" className="landingmain-link">HOME</Link></li>
          <li><a href="#" className="landingmain-link">SHOP HERE</a></li>
          <li><a href="/#about" className="landingmain-link">ABOUT US</a></li>
          <li><a href="/#contact" className="landingmain-link">CONTACT</a></li>
          <li><Link to="/account" className="signup-link-nav">ACCOUNT</Link></li>
        </ul>
      </nav>

      <div className="signup-navbar-icons">
        <img src={cartIcon} alt="Cart" className="signup-navbar-icon" />
        <img src={accountIcon} alt="Account" className="signup-navbar-icon" />
      </div>

      <div className="signup-flower-container">
        <img src={require("../assets/flower.png")} alt="Flower" className="signup-flower-img" />
      </div>

      <div className="signup-subframe-container">
        <img src={require("../assets/subframe.png")} alt="Subframe" className="signup-subframe-img" />
        <div className="signup-card">
          <h2>Create Account</h2>

          <div className="signup-name-container">
            <div className="signup-input-box-half">
              <label htmlFor="firstName">First Name</label>
              <input type="text" id="firstName" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="signup-input-box-half">
              <label htmlFor="lastName">Last Name</label>
              <input type="text" id="lastName" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="signup-input-box">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input type="text" id="phoneNumber" placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>

          <div className="signup-input-box">
            <label htmlFor="homeAddress">Home Address</label>
            <input type="text" id="homeAddress" placeholder="Home Address" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
          </div>

          <div className="signup-input-box">
            <label htmlFor="signupEmail">Email Address</label>
            <input type="text" id="signupEmail" placeholder="Email Address" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} />
          </div>

          <div className="signup-password-container">
            <div className="signup-input-box">
              <label htmlFor="signUpPassword">Password</label>
              <input ref={passwordRef} type={showPassword ? "text" : "password"} id="signUpPassword" placeholder="Password" maxLength="16" value={signUpPassword} onChange={(e) => { setSignUpPassword(e.target.value); checkPasswordStrength(e.target.value); }} />
              <img src={require("../assets/showpassword.png")} alt="Show Password" className={`signup-toggle-password ${showPassword ? "signup-hidden" : ""}`} onClick={() => togglePasswordVisibility(passwordRef)} />
              <img src={require("../assets/hidepassword.png")} alt="Hide Password" className={`signup-toggle-password ${showPassword ? "" : "signup-hidden"}`} onClick={() => togglePasswordVisibility(passwordRef)} />
              <div className="signup-password-strength-lines">
                {[1,2,3].map((line) => {
                  let bgColor = "#ccc";
                  if (passwordStrengthLevel >= line) {
                    if (line === 1) bgColor = "#ff4d4f";
                    if (line === 2) bgColor = "#ffa500";
                    if (line === 3) bgColor = "#1e90ff";
                  }
                  return <div key={line} className="strength-line" style={{ backgroundColor: bgColor }}></div>;
                })}
              </div>
            </div>

            <div className="signup-input-box">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input ref={confirmRef} type={showPassword ? "text" : "password"} id="confirmPassword" placeholder="Confirm Password" maxLength="16" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <img src={require("../assets/showpassword.png")} alt="Show Password" className={`signup-toggle-password ${showPassword ? "signup-hidden" : ""}`} onClick={() => togglePasswordVisibility(confirmRef)} />
              <img src={require("../assets/hidepassword.png")} alt="Hide Password" className={`signup-toggle-password ${showPassword ? "" : "signup-hidden"}`} onClick={() => togglePasswordVisibility(confirmRef)} />
            </div>
          </div>

          <button className="signup-btn" onClick={handleManualSignUp}>Sign Up</button>

          <div className="signup-divider">OR</div>

          <p className="signup-text">
            Already have an account? <Link to="/login" className="signup-link">Log In</Link>
          </p>

          <button className="signup-image-btn" onClick={handleGoogleSignUp}>
            <img src={require("../assets/signupwith.png")} alt="Register with Google" />
          </button>

        </div>
      </div>
    </div>
  );
}
