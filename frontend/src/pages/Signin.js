import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs";
import "./Signin.css";
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";
import { auth } from "../firebase/firebase";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile, signOut} from "firebase/auth";

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
  if (!firstName || !lastName || !phoneNumber || !homeAddress || !signUpEmail || !signUpPassword || !confirmPassword) {
    showToast("⚠️ Fill in all fields!");
    return;
  }

  if (signUpPassword !== confirmPassword) {
    showToast("⚠️ Passwords do not match!");
    return;
  }

  try {
    // 1️⃣ Create Firebase account (just to get UID)
    const userCredential = await createUserWithEmailAndPassword(auth, signUpEmail, signUpPassword);
    const user = userCredential.user;

    // 2️⃣ Update displayName in Firebase
    await updateProfile(user, { displayName: `${firstName} ${lastName}` });

    // 3️⃣ Hash the password before saving to Mongo
    const hashedPassword = await bcrypt.hash(signUpPassword, 10);

    // 4️⃣ Prepare payload for Mongo
    const payload = {
      uid: user.uid,
      firstName,
      lastName,
      phoneNumber,
      homeAddress,
      email: signUpEmail,
      password: hashedPassword, // <— use hashed password
      displayName: `${firstName} ${lastName}`,
      signInMethod: "manual",
      photoURL: "" // optional
    };

    // 5️⃣ Save to Mongo
    const res = await fetch("http://127.0.0.1:5001/api/users/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Unable to save user");

    showToast("✅ Account created successfully!");
    navigate("/login");
  } catch (err) {
    console.error("Manual signup error:", err);
    showToast("⚠️ Unable to save account to database.");
  }
};

  // ---------------- Google Sign-Up ----------------
  const handleGoogleSignUp = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userObj = {
        uid: user.uid,
        firstName: user.displayName?.split(" ")[0] || "",
        lastName: user.displayName?.split(" ")[1] || "",
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        phoneNumber: phoneNumber || "",
        homeAddress: homeAddress || "",
        signInMethod: "google"
      };

      const res = await fetch("http://127.0.0.1:5001/api/users/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userObj),
      });

      const resultDB = await res.json();
      if (!res.ok) throw new Error(resultDB.message || "Google signup failed");
        await signOut(auth);
      showToast("✅ Google account saved successfully!");
      navigate("/login"); // navigate to login page
    } catch (error) {
      console.error("Google sign-up error:", error.message);
      showToast("⚠️ Google sign-up failed!");
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
