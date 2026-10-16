import { clearSession } from '../shoppingSession';
import OrderProgress from '../components/OrderProgress';
import { statusLabels, paymentLabel, isActive, addressLabel } from '../orderWorkflow';
import OrderLines from '../components/OrderLines';
import StoreHeader from '../components/StoreHeader';
import './CoffeeShop.css';
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";  
import "./LoginUser.css";
import { auth } from "../firebase/firebase";
import { updateProfile } from "firebase/auth";
import logo from "../assets/coffee-logo.svg";
import { apiRequest } from "../api";

export default function LoginUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [orderError,setOrderError]=useState('');
  const [ordersLoading,setOrdersLoading]=useState(false);
  const [orderFilter,setOrderFilter]=useState('all');
  const [cancelling,setCancelling]=useState('');
  const navigate = useNavigate();
  const notificationLocation = useLocation();
  const notificationFocus = useRef('');
  useEffect(() => {
    const id = new URLSearchParams(notificationLocation.search).get('order');
    if (!id) { notificationFocus.current = ''; return; }
    if (notificationFocus.current === id) return;
    setOrderFilter('all');
    const target = document.getElementById(`order-${id}`);
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); notificationFocus.current = id; }
  }, [notificationLocation.search, orderHistory, orderFilter]);

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
    setBio(localUser.bio || '');
    setProfileImage(localUser.profileImageUrl || '');
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
            bio,
            profileImageUrl: profileImage || '',
          }),
        });
        if (!ok) throw new Error(data?.message || 'Profile update failed.');
        const currentUser = JSON.parse(localStorage.getItem('user_currentUser')) || {};
        localStorage.setItem('user_currentUser', JSON.stringify({ ...currentUser, ...data.payload }));
      }
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
      setEditing(false);
      alert("✅ Profile updated successfully!");
      console.log("Profile saved for user:", user.uid);
    } catch (err) {
      console.error("Profile update error:", err);
      alert(`❌ Failed to update profile: ${err.message}`);
    }
  };

  const cancelPendingOrder = async (order) => {
    if(cancelling || !window.confirm(`Cancel order ${order.orderNumber}?`))return;
    setCancelling(order._id);
    try {const {ok,data}=await apiRequest(`/orders/mine/${order._id}/cancel`,{method:'POST',body:JSON.stringify({reason:'Cancelled by customer'})});if(!ok)throw new Error(data?.message || 'Unable to cancel this order.');await refreshOrders();}
    catch(error){setOrderError(error.message || 'Unable to cancel this order.');}
    finally{setCancelling('');}
  };
  const refreshOrders = async () => {
    setOrdersLoading(true);
    try {const {ok,data}=await apiRequest('/orders/mine');if(!ok || !Array.isArray(data?.payload))throw new Error(data?.message || 'Unable to load order history.');setOrderHistory(data.payload);setOrderError('');}
    catch(error){setOrderError(error.message || 'Unable to reach the order service.');}
    finally{setOrdersLoading(false);}
  };
  useEffect(()=>{if(!user)return undefined;refreshOrders();const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshOrders();},30000);return()=>clearInterval(timer);},[user,notificationLocation.search]);

 const handleLogout = async () => {
  try {
    clearSession();
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
      <div className="coffee-account-header"><StoreHeader /></div>

      <div className="loginuser-left">
        <div className="profile-pic-wrapper">
          <img src={profileImage || require("../assets/coffee-cup.svg")} alt="Profile" className="profile-pic" onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src=require("../assets/coffee-cup.svg");}} />
          {editing && <input type="url" value={profileImage || ''} onChange={(event) => setProfileImage(event.target.value)} placeholder="Profile image URL" aria-label="Profile image URL" />}
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
        <div className="account-order-actions"><button className="track-btn" onClick={() => document.querySelector('.order-history-title')?.scrollIntoView({ behavior: 'smooth' })}>Track orders</button><button className="track-btn" type="button" onClick={refreshOrders} disabled={ordersLoading}>Refresh orders</button></div>
        <h1 className="order-history-title">Your coffee orders</h1><p className="workflow-refresh-note">Active orders update every 30 seconds while this page is open.</p><div className="customer-order-filters">{['all','active','past'].map(filter=><button type="button" key={filter} aria-pressed={orderFilter===filter} onClick={()=>setOrderFilter(filter)}>{filter==='all'?'All orders':filter==='active'?'In progress':'Past orders'}</button>)}</div>{orderError&&<p role="alert" className="workflow-error">{orderError}</p>}{ordersLoading&&!orderHistory.length&&<p role="status">Loading your orders...</p>}
        {orderHistory.length>0&&!orderHistory.some(order=>orderFilter==='all'||(orderFilter==='active'?isActive(order):!isActive(order)))&&<p className="workflow-empty">No orders in this view.</p>}
        <div className="order-list">
          {orderHistory.length === 0 && <div className="orders-empty"><span aria-hidden="true">☕</span><h2>Your order history will appear here.</h2><p>When you place an order, you can follow its progress from this page.</p><Link to="/shop">Browse the coffee menu</Link></div>}
          {orderHistory.filter(order=>orderFilter==='all'||(orderFilter==='active'?isActive(order):!isActive(order))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map((order) => (
            <article className="order-item" id={`order-${order._id}`} key={order._id}>
              <div className="order-card-top"><span className={`order-status order-status-${String(order.status || 'pending').toLowerCase()}`}>{statusLabels[order.status] || order.status}</span><span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span></div>
              <div className="order-info">
                <OrderLines order={order} />
                <p className="order-id">Order <span>#{order.orderNumber}</span></p>
                <p className="order-date">Payment · <strong>{paymentLabel(order)}</strong></p>
                {order.paymentMethod === 'online' && order.paymentStatus === 'pending' && order.status === 'pending' && order.paymentCheckoutUrl && <a className="cancel-order-btn" href={order.paymentCheckoutUrl}>Continue secure payment</a>}
                {order.status === 'pending' && !(order.paymentMethod==='online'&&order.paymentStatus==='paid'&&order.grandTotal>0) && <button className="cancel-order-btn" type="button" disabled={!!cancelling} onClick={() => cancelPendingOrder(order)}>{cancelling===order._id?'Cancelling...':'Cancel order'}</button>}
              </div>
              <div className="order-meta">
                <p>{order.products?.reduce((sum, item) => sum + item.quantity, 0) || 0} item(s)</p>
                {!!order.vouchersApplied?.length && <p className="order-voucher-savings">{order.vouchersApplied.map((applied) => applied.voucher?.voucher?.code).filter(Boolean).join(', ') || 'Voucher'} savings · − ₱ {order.vouchersApplied.reduce((sum, applied) => sum + (Number(applied.discountAmount) || 0), 0).toLocaleString()}</p>}
                <p>₱ {(Number(order.grandTotal) || 0).toLocaleString()}</p>
              </div>
              {order.deliveryAddress && <details className="customer-order-delivery"><summary>Delivery details</summary><p>{addressLabel(order.deliveryAddress)}</p>{order.deliveryAddress.riderInstructions&&<p>{order.deliveryAddress.riderInstructions}</p>}</details>}
              <OrderProgress order={order}/>
            </article>
          ))}
        </div>
        <button className="logout-btn" onClick={handleLogout}>LOGOUT</button>
      </div>
    </div>
  );
}
