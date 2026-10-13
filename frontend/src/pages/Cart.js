import React, { useEffect, useState } from "react";
import { FaPlus, FaMinus } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Cart.css";
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";
import { apiRequest } from "../api";

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState({ latitude: '', longitude: '', apartmentBuildingLotNumber: '', street: '', barangay: '', city: '', province: '', zipCode: '', riderInstructions: '' });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const shippingFee = 0;
  const location = useLocation();
  const navigate = useNavigate();

  const handleAccountClick = () => navigate("/account");

  const scrollToSection = (sectionId) => {
    navigate("/landingmain", { state: { scrollTo: sectionId } });
  };

  // ---------------- Fetch cart from local storage ----------------
  useEffect(() => {
    const storedCart = JSON.parse(localStorage.getItem("cartItems")) || [];
    setCartItems(storedCart);
  }, []);

  // ---------------- Helper: Save cart to local storage ----------------
  const saveCartToBackend = async (updatedCart) => {
    localStorage.setItem('cartItems', JSON.stringify(updatedCart));
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

  const handleCheckout = async (event) => {
    event?.preventDefault();
    let currentUser;
    try {
      currentUser = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
    } catch (error) {
      localStorage.removeItem('user_currentUser');
    }
    if (!localStorage.getItem('user_token') || currentUser?.role !== 'customer') {
      alert('Please log in before checking out.');
      navigate('/account');
      return;
    }

    if (!cartItems.length || isCheckingOut) return;

    setIsCheckingOut(true);
    try {
      const { ok, data } = await apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          deliveryAddress: {
            ...deliveryAddress,
            latitude: Number(deliveryAddress.latitude),
            longitude: Number(deliveryAddress.longitude),
          },
          products: cartItems.map((item) => ({
            product: item._id,
            quantity: item.quantity,
            addons: [],
          })),
        }),
      });

      if (!ok) {
        throw new Error(data?.message || 'Unable to place order.');
      }

      localStorage.removeItem('cartItems');
      setCartItems([]);
      alert(`Order ${data?.payload?.orderNumber || ''} placed successfully.`);
    } catch (error) {
      alert(error.message || 'Unable to reach the order service.');
    } finally {
      setIsCheckingOut(false);
    }
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
              <select aria-label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </div>

            <form className="checkout-address" onSubmit={handleCheckout}>
              <h2>Delivery Address</h2>
              <input aria-label="Latitude" type="number" step="any" placeholder="Latitude" required value={deliveryAddress.latitude} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, latitude: event.target.value })} />
              <input aria-label="Longitude" type="number" step="any" placeholder="Longitude" required value={deliveryAddress.longitude} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, longitude: event.target.value })} />
              <input aria-label="Unit or lot number" placeholder="Unit / building / lot number" required value={deliveryAddress.apartmentBuildingLotNumber} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, apartmentBuildingLotNumber: event.target.value })} />
              <input aria-label="Street" placeholder="Street" required value={deliveryAddress.street} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, street: event.target.value })} />
              <input aria-label="Barangay" placeholder="Barangay" required value={deliveryAddress.barangay} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, barangay: event.target.value })} />
              <input aria-label="City" placeholder="City" required value={deliveryAddress.city} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, city: event.target.value })} />
              <input aria-label="Province" placeholder="Province" required value={deliveryAddress.province} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, province: event.target.value })} />
              <input aria-label="ZIP code" placeholder="ZIP code" required value={deliveryAddress.zipCode} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, zipCode: event.target.value })} />
              <input aria-label="Delivery instructions" placeholder="Delivery instructions (optional)" value={deliveryAddress.riderInstructions} onChange={(event) => setDeliveryAddress({ ...deliveryAddress, riderInstructions: event.target.value })} />
              <button className="checkout-btn" type="submit" disabled={!cartItems.length || isCheckingOut}>
                {isCheckingOut ? 'PLACING ORDER...' : 'CHECKOUT'}
              </button>
            </form>

            <p className="note">NOTE: Total Amount may still vary once you checked out.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
