import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";  
import "./LoginUser.css";
import { auth } from "../firebase/firebase";
import { updateProfile } from "firebase/auth";
import logo from "../assets/logo_a.png";
import { apiRequest } from "../api";

export default function LoginUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const navigate = useNavigate();

  // Fetch logged-in user
  useEffect(() => {
  let localUser;
  try {
    localUser = JSON.parse(localStorage.getItem("user_currentUser") || 'null');
  } catch (error) {
    localStorage.removeItem('user_currentUser');
  }
  const isLoggedIn = localStorage.getItem("user_isLoggedIn") === "true";

  if (localUser && isLoggedIn && localStorage.getItem('user_token') && localUser.role === 'customer') {
    setUser(localUser); // use localStorage user
    setName(localUser.displayName || localUser.name || `${localUser.firstName || ''} ${localUser.lastName || ''}`.trim() || "Your Name");
    const profileKey = localUser._id || localUser.uid;
    setBio(localStorage.getItem(`bio_${profileKey}`) || "");
    setProfileImage(localStorage.getItem(`profileImg_${profileKey}`));
    if (localStorage.getItem('user_token')) {
      apiRequest('/orders/mine')
        .then(({ ok, data }) => setOrderHistory(ok && Array.isArray(data?.payload) ? data.payload : []))
        .catch((error) => console.error('Unable to load order history:', error));
    }
    setLoading(false);
    return;
  }
  navigate('/account', { replace: true });
  setLoading(false);
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
      const profileKey = user._id || user.uid;
      const nameParts = name.trim().split(/\s+/);
      if (localStorage.getItem('user_token') && nameParts.length) {
        const { ok, data } = await apiRequest('/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || nameParts[0],
          }),
        });
        if (!ok) throw new Error(data?.message || 'Profile update failed.');
        const currentUser = JSON.parse(localStorage.getItem('user_currentUser')) || {};
        localStorage.setItem('user_currentUser', JSON.stringify({ ...currentUser, ...data.payload }));
      }
      if (preview) {
        localStorage.setItem(`profileImg_${profileKey}`, preview);
        setProfileImage(preview);
      }
      localStorage.setItem(`bio_${profileKey}`, bio);
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
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
    // Clear all auth-related info from localStorage
    localStorage.removeItem("user_currentUser");
    localStorage.removeItem("user_isLoggedIn");
    localStorage.removeItem("user_token");
    localStorage.removeItem("currentUserEmail");
    localStorage.removeItem("currentUserType");
    localStorage.removeItem("userType");
    localStorage.removeItem("userEmail");

    // Clear any user-specific localStorage (if you store profile info)
    if (user?.uid) {
      const profileKey = user._id || user.uid;
      localStorage.removeItem(`bio_${profileKey}`);
      localStorage.removeItem(`profileImg_${profileKey}`);
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
          <button className="track-btn" onClick={() => document.querySelector('.order-history-title')?.scrollIntoView({ behavior: 'smooth' })}>TRACK ORDERS</button>
        <h1 className="order-history-title">Order History</h1>
        <div className="order-list">
          {orderHistory.length === 0 && <p>No orders yet.</p>}
          {orderHistory.map((order) => (
            <div className="order-item" key={order._id}>
              <div className="order-info">
                <p className="order-name">{order.products?.map((item) => item.product?.name || 'Product').join(', ')}</p>
                <p className="order-id">Order #: {order.orderNumber}</p>
                <p className="order-date">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="order-meta">
                <p>Qty: {order.products?.reduce((sum, item) => sum + item.quantity, 0) || 0}</p>
                <p>₱ {(Number(order.grandTotal) || 0).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="logout-btn" onClick={handleLogout}>LOGOUT</button>
      </div>
    </div>
  );
}
