import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";  
import "./LoginUser.css";
import { auth } from "../firebase/firebase";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import logo from "../assets/logo_a.png";

export default function LoginUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const navigate = useNavigate();

  // Fetch logged-in user
  useEffect(() => {
  const localUser = JSON.parse(localStorage.getItem("user_currentUser"));
  const isLoggedIn = localStorage.getItem("user_isLoggedIn") === "true";

  if (localUser && isLoggedIn) {
    setUser(localUser); // use localStorage user
    setName(localUser.displayName || localUser.name || "Your Name");
    setBio(localStorage.getItem(`bio_${localUser.uid}`) || "");
    setProfileImage(localStorage.getItem(`profileImg_${localUser.uid}`));
    setLoading(false);
    return;
  }

  // fallback to Firebase auth
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      setUser(firebaseUser);
      setName(firebaseUser.displayName || "Your Name");
      setBio(localStorage.getItem(`bio_${firebaseUser.uid}`) || "");
      setProfileImage(localStorage.getItem(`profileImg_${firebaseUser.uid}`));
    } else {
      console.log("No user found, redirecting to login");
      navigate("/account", { replace: true });
    }
    setLoading(false);
  });

  return () => unsubscribe();
}, [navigate]);

const handleAccountClick = () => {
  const isLoggedIn = localStorage.getItem("user_isLoggedIn");  // ✅ match login key
  const currentUser = localStorage.getItem("user_currentUser"); // ✅ optional check

  if (currentUser && isLoggedIn === "true") {
    // You can keep these if your app uses them
    localStorage.setItem("currentUserEmail", localStorage.getItem("currentUserEmail") || "");
    localStorage.setItem("currentUserType", localStorage.getItem("currentUserType") || "user");

    navigate('/userinfo');
  } else {
    navigate('/account');
  }
};

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("❌ Image too large! Max 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      if (preview) {
        localStorage.setItem(`profileImg_${user.uid}`, preview);
        setProfileImage(preview);
      }
      localStorage.setItem(`bio_${user.uid}`, bio);
      await updateProfile(auth.currentUser, { displayName: name });
      setEditing(false);
      alert("✅ Profile updated successfully!");
      console.log("Profile saved for user:", user.uid);
    } catch (err) {
      console.error("Profile update error:", err);
      alert(`❌ Failed to update profile: ${err.message}`);
    }
  };

 const handleLogout = async () => {
  try {
    const token = localStorage.getItem("user_token");

    // Optional: notify backend to invalidate token
    if (token) {
      await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
    }

    // Clear all auth-related info from localStorage
    localStorage.removeItem("user_currentUser");
    localStorage.removeItem("user_isLoggedIn");
    localStorage.removeItem("user_token");
    localStorage.removeItem("currentUserEmail");
    localStorage.removeItem("currentUserType");

    // Clear any user-specific localStorage (if you store profile info)
    if (user?.uid) {
      localStorage.removeItem(`bio_${user.uid}`);
      localStorage.removeItem(`profileImg_${user.uid}`);
    }

    // Clear user state
    setUser(null);

    // Redirect to landing page
    navigate("/landingmain", { replace: true });

    console.log("✅ Logout successful");
  } catch (err) {
    console.error("Logout error:", err);
    alert("❌ Logout failed. Please try again.");
  }
};

  const orderHistory = [
    { id: "001", name: "Nurture Flower Vase", price: "₱3,395", qty: 1, date: "2023-10-15" },
    { id: "002", name: "Serena Grace", price: "₱2,995", qty: 1, date: "2023-10-10" },
    { id: "003", name: "Dalisay Charm", price: "₱2,995", qty: 1, date: "2023-10-05" },
  ];

  if (loading) {
    return (
      <div className="loginuser-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f0f0' }}>
        <p>Loading user profile...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="loginuser-container">
      <nav className="loginuser-navbar">
        <img src={logo} alt="Sampaguita Logo" className="login-logo" />
        <ul className="landing-nav-links">
          <li><Link to="/landingmain" className="landingmain-link">HOME</Link></li>
          <li><Link to="/shop" className="landingmain-link">SHOP HERE</Link></li>
          <li><Link to="/#about" className="landingmain-link">ABOUT US</Link></li>
          <li><Link to="/#contact" className="landingmain-link">CONTACT</Link></li>
          <li>
            <Link
              to="/account"
              onClick={(e) => { e.preventDefault(); handleAccountClick(); }}
              className="landingmain-link"
            >
              ACCOUNT
            </Link>
          </li>
        </ul>
      </nav>

      <div className="loginuser-left">
        <div className="profile-pic-wrapper">
          <img src={preview || profileImage || require("../assets/tulips.png")} alt="Profile" className="profile-pic" />
          {editing && <input type="file" accept="image/*" onChange={handleImageChange} style={{ marginTop: '10px' }} />}
        </div>

        {editing ? (
          <input type="text" className="edit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
        ) : (
          <h2 className="user-name">{name}</h2>
        )}
        <p className="user-email">{user.email}</p>

        {editing ? (
          <textarea className="edit-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write something about yourself..." rows={3} />
        ) : (
          <p className="bio">{bio || "No bio yet. Edit to add one!"}</p>
        )}

        {editing ? (
          <button className="save-btn" onClick={handleSaveProfile}>Save Profile</button>
        ) : (
          <button className="edit-btn" onClick={() => setEditing(true)}>Edit Profile</button>
        )}
      </div>

      <div className="loginuser-right">
        <button className="track-btn">TRACK ORDERS</button>
        <h1 className="order-history-title">Order History</h1>
        <div className="order-list">
          {orderHistory.map((order) => (
            <div className="order-item" key={order.id}>
              <div className="order-info">
                <p className="order-name">{order.name}</p>
                <p className="order-id">Order #: {order.id}</p>
                <p className="order-date">Date: {order.date}</p>
              </div>
              <div className="order-meta">
                <p>Qty: {order.qty}</p>
                <p>{order.price}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="logout-btn" onClick={handleLogout}>LOGOUT</button>
      </div>
    </div>
  );
}
