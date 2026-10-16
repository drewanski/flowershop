import { getShoppingScope, STORE_EVENT } from './shoppingSession';
import { roleHome } from './roleAccess';
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
//pages
import Landinglog from "./pages/Landinglog.js";
import Login from "./pages/Login.js";
import Landingmain from "./pages/Landingmain.js";
import SignUp from "./pages/Signin.js";
import CoffeeShopPage from "./pages/CoffeeShopPage.js";
import LoginUser from "./pages/LoginUser";
import AdminPanel from "./pages/AdminPanel";
import UserInfo from "./pages/LoginUser.js";
import ViewDetails from './pages/ViewDetails.js';
import Cart from "./pages/Cart.js";
import PaymentResult from "./pages/PaymentResult.js";
import DeliveryPanel from "./pages/DeliveryPanel.js";
import PasswordReset from "./pages/PasswordReset.js";


//assets
import Wishlist from './pages/Wishlist';
import NotificationCenter from './components/NotificationCenter';

const RequireRole = ({ allowedRoles, redirectTo, children }) => {
  const location = useLocation();
  const token = localStorage.getItem('user_token');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
  } catch (error) {
    localStorage.removeItem('user_currentUser');
  }

  if (!token || !user) return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
};


function App() {
  const [shoppingScope, setShoppingScope] = useState(getShoppingScope);
  useEffect(() => { const update = () => setShoppingScope(getShoppingScope()); window.addEventListener(STORE_EVENT, update); window.addEventListener('storage', update); return () => { window.removeEventListener(STORE_EVENT, update); window.removeEventListener('storage', update); }; }, []);
  return (
  <Router>
    <NotificationCenter />
    <Routes key={shoppingScope}>
      <Route path="/" element={<Landingmain />} />
      <Route path="/employee-login" element={<Navigate to="/login" replace />} />
      <Route path="/delivery" element={<RequireRole allowedRoles={['delivery']} redirectTo="/employee-login"><DeliveryPanel /></RequireRole>} />

        {/* Admin Dashboard */}
        <Route path="/adminpanel" element={<RequireRole allowedRoles={['admin', 'manager', 'crew']} redirectTo="/employee-login"><AdminPanel /></RequireRole>} />

      {/* Default landing page */}
      <Route path="/landingmain" element={<Landingmain />} />
      <Route path="/account" element={<Landinglog />} />
      <Route path="/login" element={<Login />} />
      <Route path="/password-reset" element={<PasswordReset />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/shop" element={<CoffeeShopPage />} />
        <Route path="/products/:productId" element={<ViewDetails />} />
        <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/loguser" element={<RequireRole allowedRoles={['customer']} redirectTo="/account"><LoginUser /></RequireRole>} />
      <Route path="/userinfo" element={<RequireRole allowedRoles={['customer']} redirectTo="/account"><UserInfo /></RequireRole>} />
         <Route path="/viewdetails" element={<ViewDetails/>}/>
          <Route path="/cart" element={<Cart key="cart"/>}/>
          <Route path="/checkout" element={<RequireRole allowedRoles={['customer']}><Cart key="checkout"/></RequireRole>}/>
          <Route path="/payment/result" element={<RequireRole allowedRoles={['customer']} redirectTo="/account"><PaymentResult /></RequireRole>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>


  </Router>
    );
  }

export default App;
