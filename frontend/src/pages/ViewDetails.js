import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./ViewDetails.css";
import { FaCartPlus, FaHeart, FaPlus, FaMinus } from "react-icons/fa";
import foeter from "../assets/footer.png";
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";

export default function ViewDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ FIX: define flower state
  const [flower, setFlower] = useState(location.state?.flower || null);
  const [quantity, setQuantity] = useState(1);

  const handleAccountClick = () => navigate("/account");

  // ✅ FIX: always call hooks at top level
  useEffect(() => {
    if (location.state?.flower) {
      // store in localStorage for refresh persistence
      setFlower(location.state.flower);
      localStorage.setItem("selectedFlower", JSON.stringify(location.state.flower));
    } else {
      const storedFlower = localStorage.getItem("selectedFlower");
      if (storedFlower) {
        setFlower(JSON.parse(storedFlower));
      }
    }
  }, [location.state]);

  // ✅ Scroll helper
  const scrollToSection = (sectionId) => {
    navigate("/landingmain", { state: { scrollTo: sectionId } });
  };

  if (!flower) {
    return <div className="viewdetails-empty">Loading flower details...</div>;
  }

  // ✅ Quantity handlers
  const handleAdd = () => {
  if (quantity < flower.stock) {
    setQuantity(quantity + 1);
  } else {
    alert("You've reached the maximum stock available!");
  }
};

const handleSubtract = () => {
  if (quantity > 1) {
    setQuantity(quantity - 1);
  }
};

 const handleAddToCart = async () => {
    const currentUser = JSON.parse(localStorage.getItem('user_currentUser'));
    const isLoggedInFlag = localStorage.getItem('user_isLoggedIn');
    const loggedIn = currentUser && isLoggedInFlag === 'true';

    const cartItem = {
      _id: flower._id || flower.name,
      name: flower.name,
      price: flower.price,
      quantity,
      img: flower.image || flower.img,
      stock: flower.stock,
    };

    const storedCart = JSON.parse(localStorage.getItem('cartItems')) || [];
    const existingIndex = storedCart.findIndex((item) => item._id === cartItem._id);

    if (existingIndex >= 0) {
      if (storedCart[existingIndex].quantity + quantity > flower.stock) {
        alert("You've reached the maximum stock available!");
        return;
      }
      storedCart[existingIndex].quantity += quantity;
    } else {
      storedCart.push(cartItem);
    }

    localStorage.setItem('cartItems', JSON.stringify(storedCart));
    alert(`${flower.name} added to cart!`);
    navigate('/cart');
  };


  const handleAddToWishlist = () => {
    alert(`${flower.name} added to wishlist!`);
  };

  return (
    <div
      className="viewdetails-page"
      style={{
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 🌸 Navbar */}
      <nav className="navbar">
        <div className="logo-nav-wrapper">
          <img src={logo} alt="Sampaguita Logo" className="logo" />
          <ul className="landing-nav-links">
            <li>
              <Link to="/landingmain">HOME</Link>
            </li>
            <li>
              <Link to="/shop">SHOP HERE</Link>
            </li>
            <li>
              <a
                href="/landingmain#about"
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
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("contact");
                }}
              >
                CONTACT
              </a>
            </li>
            <li>
              <Link to="/account">ACCOUNT</Link>
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

      {/* 🌹 MAIN FLOWER DETAILS */}
      <div className="viewdetails-container">
        <div className="viewdetails-image-container">
          <img src={flower.image || flower.img} alt={flower.name} className="viewdetails-image" />
        </div>

        <div className="viewdetails-info">
          <h1 className="flower-title">{flower.name}</h1>
          <h2 className="flower-price">₱ {flower.price.toLocaleString()}</h2>
        <p className="availability">
  <b>Availability:</b>{" "}
  <span className={flower.stock > 0 ? "in-stock" : "out-of-stock"}>
    {flower.stock > 0 ? "In Stock" : "Out of Stock"}
  </span>
</p>

         <p className="flower-description">{flower.description}</p>

          <p className="flower-meta">
            <b>Focal Flowers:</b> {flower.focalFlowers} <br />
            <b>Fillers:</b> {flower.fillers}
          </p>

          <div className="quantity-section">
            <p className="quantity-label">QUANTITY:</p>
            <div className="quantity-controls">
              <button onClick={handleSubtract}>
                <FaMinus />
              </button>
              <span>{quantity}</span>
              <button onClick={handleAdd}>
                <FaPlus />
              </button>
            </div>
          </div>

          <div className="action-buttons">
           <button
  className={`add-cart-btn ${flower.stock === 0 ? "disabled" : ""}`}
  onClick={handleAddToCart}
  disabled={flower.stock === 0}
>
  <FaCartPlus /> {flower.stock === 0 ? "OUT OF STOCK" : "ADD TO CART"}
</button>

            <button className="add-wishlist-btn" onClick={handleAddToWishlist}>
              <FaHeart /> ADD TO WISHLIST
            </button>
          </div>
        </div>
      </div>

      {/* 🌷 Decorative Footer */}
{/* 🌷 Decorative Footer */}
<div className="ViewDetails-footer">
  <img src={foeter} alt="Decorative bottom" />
</div>
    </div>
  );
}
