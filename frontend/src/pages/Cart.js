import React, { useEffect, useState } from "react";
import { FaPlus, FaMinus } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Cart.css";
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const shippingFee = 200;
  const location = useLocation();
  const navigate = useNavigate();

  const handleAccountClick = () => navigate("/account");

  const scrollToSection = (sectionId) => {
    navigate("/landingmain", { state: { scrollTo: sectionId } });
  };

  // ---------------- Fetch cart from backend ----------------
  useEffect(() => {
    const loadCart = async () => {
      const currentUser = JSON.parse(localStorage.getItem("user_currentUser"));
      const isLoggedInFlag = localStorage.getItem("user_isLoggedIn");
      const loggedIn = currentUser && isLoggedInFlag === "true";

      if (loggedIn) {
        try {
          const res = await fetch(`http://localhost:5001/api/cart/${currentUser._id}`);
          const data = await res.json();
          setCartItems(data.cart || []);
        } catch (err) {
          console.error("Error fetching cart:", err);
        }
      } else {
        // fallback for guests
        const storedCart = JSON.parse(localStorage.getItem("cartItems")) || [];
        setCartItems(storedCart);
      }
    };

    loadCart();
  }, []);

  // ---------------- Helper: Save cart to backend ----------------
  const saveCartToBackend = async (updatedCart) => {
    const currentUser = JSON.parse(localStorage.getItem("user_currentUser"));
    if (!currentUser) return;

    try {
      await fetch("http://localhost:5001/api/cart/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser._id, cart: updatedCart }),
      });
    } catch (err) {
      console.error("Failed to update cart in backend:", err);
    }
  };

  // ---------------- Quantity controls ----------------
  const handleIncrease = (id) => {
    const updated = cartItems.map((item) => {
      if (item._id === id) {
        if (item.quantity < item.stock) return { ...item, quantity: item.quantity + 1 };
        alert("You've reached the maximum stock available!");
      }
      return item;
    });
    setCartItems(updated);
    saveCartToBackend(updated);
  };

  const handleDecrease = (id) => {
    const updated = cartItems.map((item) =>
      item._id === id && item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : item
    );
    setCartItems(updated);
    saveCartToBackend(updated);
  };

  // ---------------- Remove item ----------------
  const handleRemove = (id) => {
    const updated = cartItems.filter((item) => item._id !== id);
    setCartItems(updated);
    saveCartToBackend(updated);
  };

  // ---------------- Calculate totals ----------------
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal + shippingFee;

  return (
    <div style={{ backgroundImage: `url(${bg})`, minHeight: "100vh" }}>
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo-nav-wrapper">
          <img src={logo} alt="Sampaguita Logo" className="logo" />
          <ul className="landing-nav-links">
            <li>
              <Link to="/landingmain" className={location.pathname === "/" ? "active" : ""}>
                HOME
              </Link>
            </li>
            <li>
              <Link to="/shop" className={location.pathname === "/shop" ? "active" : ""}>
                SHOP HERE
              </Link>
            </li>
            <li>
              <a
                href="/landingmain#about"
                className={location.hash === "#about" ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("about");
                }}
              >
                ABOUT US
              </a>
            </li>
            <li>
              <a
                href="/landingmain#contact"
                className={location.hash === "#contact" ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("contact");
                }}
              >
                CONTACT
              </a>
            </li>
            <li>
              <Link to="/account" className={location.pathname === "/account" ? "active" : ""}>
                ACCOUNT
              </Link>
            </li>
          </ul>
        </div>
        <div className="ViewDetails-navbar-icons">
          <img src={cartIcon} alt="Cart" className="navbar-icon" />
          <img
            src={accountIcon}
            alt="Account"
            className="navbar-icon"
            onClick={handleAccountClick}
            style={{ cursor: "pointer" }}
          />
        </div>
      </nav>

      {/* CART TITLE */}
      <h1 className="cart-title">Your Shopping Cart</h1>

      <div className="cart-container">
        <div className="cart-content">
          <div className="cart-items">
            {cartItems.length === 0 ? (
              <p className="empty-cart">Your cart is empty.</p>
            ) : (
              cartItems.map((item) => (
                <div key={item._id} className="cart-item">
                  <img src={item.img} alt={item.name} className="cart-img" />
                  <div className="cart-info">
                    <h2>{item.name}</h2>
                    <p>₱ {item.price.toLocaleString()}</p>

                    <div className="quantity-control">
                      <b>Quantity:</b>
                      <div className="qty-box">
                        <button className="qty-btn" onClick={() => handleDecrease(item._id)}>
                          <FaMinus />
                        </button>
                        <input type="text" value={item.quantity} readOnly className="qty-input" />
                        <button className="qty-btn" onClick={() => handleIncrease(item._id)}>
                          <FaPlus />
                        </button>
                      </div>
                    </div>

                    {/* REMOVE BUTTON */}
                    <button className="remove-btn" onClick={() => handleRemove(item._id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Order Summary */}
          <div className="cart-summary">
            <p>
              <b>Subtotal:</b> ₱ {subtotal.toLocaleString()}
            </p>
            <p>
              <b>Shipping Fee:</b> ₱ {shippingFee.toLocaleString()}
            </p>
            <p>
              <b>Total Amount:</b> ₱ {total.toLocaleString()}
            </p>

            <div className="cart-buttons">
              <Link to="/shop">
                <button className="continue-btn">CONTINUE SHOPPING</button>
              </Link>
              <button className="checkout-btn">CHECKOUT</button>
            </div>

            <p className="note">NOTE: Total Amount may still vary once you checked out.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
