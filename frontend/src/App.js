import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
//pages
import Landinglog from "./pages/Landinglog.js"; 
import Login from "./pages/Login.js"; 
import Landingmain from "./pages/Landingmain.js";
import SignUp from "./pages/Signin.js";
import FlowerShopPage from "./pages/FlowerShopPage.js";
import LoginUser from "./pages/LoginUser";
import AdminLog from "./pages/AdminLog.js";
import AdminPanel from "./pages/AdminPanel";
import UserInfo from "./pages/LoginUser.js";
import ViewDetails from './pages/ViewDetails.js';
import Cart from "./pages/Cart.js";


//assets
import bgMusic from "./assets/music.mp3"; 

const RequireRole = ({ allowedRoles, redirectTo, children }) => {
  const token = localStorage.getItem('user_token');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
  } catch (error) {
    localStorage.removeItem('user_currentUser');
  }

  if (!token || !user) return <Navigate to={redirectTo} replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/landingmain" replace />;
  return children;
};


function App() {
  const [message, setMessage] = useState("");
  const audioRef = useRef(null);
  const fadeDuration = 3000; 


  useEffect(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.volume = 0;
      audio.currentTime = 30;
      audio.play().catch((err) => {
        console.log("Autoplay blocked:", err);
      });

      fadeIn(audio);

      const interval = setInterval(() => {
        if (audio.duration && audio.currentTime >= audio.duration - 4) {
          fadeOut(audio, () => {
            audio.currentTime = 30;
            audio.play();
            audio.volume = 0;
            fadeIn(audio);
          });
        }
      }, 500);

      return () => {
        clearInterval(interval);
        audio.pause();
        audio.currentTime = 0;
      };
    }
  }, []);

  const fadeIn = (audio) => {
    let vol = 0;
    const step = 0.05;
    const interval = setInterval(() => {
      if (vol < 1) {
        vol += step;
        audio.volume = Math.min(vol, 1);
      } else {
        clearInterval(interval);
      }
    }, fadeDuration * step); 
  };
  const fadeOut = (audio, callback) => {
    let vol = audio.volume;
    const step = 0.05;
    const interval = setInterval(() => {
      if (vol > 0) {
        vol -= step;
        audio.volume = Math.max(vol, 0);
      } else {
        clearInterval(interval);
        if (callback) callback();
      }
    }, fadeDuration * step);
  };

  return (
  <Router>
    <Routes>
      <Route path="/" element={<Landingmain />} />
      <Route path="/employee-login" element={<AdminLog />} />

        {/* Admin Dashboard */}
        <Route path="/adminpanel" element={<RequireRole allowedRoles={['admin', 'manager']} redirectTo="/employee-login"><AdminPanel /></RequireRole>} />

      {/* Default landing page */}
      <Route path="/landingmain" element={<Landingmain />} />
      <Route path="/account" element={<Landinglog />} />
      <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/shop" element={<FlowerShopPage />} />
      <Route path="/loguser" element={<RequireRole allowedRoles={['customer']} redirectTo="/account"><LoginUser /></RequireRole>} />
      <Route path="/userinfo" element={<RequireRole allowedRoles={['customer']} redirectTo="/account"><UserInfo /></RequireRole>} />
         <Route path="/viewdetails" element={<ViewDetails/>}/>
           <Route path="/cart" element={<Cart/>}/>
    </Routes>

    <audio ref={audioRef} src={bgMusic} />
  </Router>
    );
  }

export default App;
