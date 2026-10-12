import axios from "axios";
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";
import "./FlowerShopPage.css";

const FlowerShopPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priceFilter, setPriceFilter] = useState("All");
  const [flowerTypeFilter, setFlowerTypeFilter] = useState("All");
  const [flowerItems, setFlowerItems] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

const [isLoggedIn, setIsLoggedIn] = useState(false);

useEffect(() => {
  const currentUser = localStorage.getItem("user_currentUser");
  const isLoggedInFlag = localStorage.getItem("user_isLoggedIn");
  setIsLoggedIn(currentUser && isLoggedInFlag === "true");
}, []);

// Helper function to scroll via state
const scrollToSection = (sectionId) => {
  navigate("/landingmain", { state: { scrollTo: sectionId } });
};

const handleViewDetails = (flower) => {
  localStorage.setItem("selectedFlower", JSON.stringify(flower)); // store locally
  navigate("/viewdetails", { state: { flower } });
};


 const goToCart = () => {
    navigate("/cart");
  };
  const handleAccountClick = () => {
  navigate(isLoggedIn ? "/loguser" : "/account");
};


  // Fetch flowers from backend
  useEffect(() => {
    const fetchFlowers = async () => {
      try {
        const response = await axios.get("http://localhost:5001/api/flowers");
        setFlowerItems(response.data);
      } catch (error) {
        console.error("Error fetching flowers:", error);
      }
    };
    fetchFlowers();
  }, []);

  // Filter logic
  const filteredFlowers = flowerItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    const matchesType = flowerTypeFilter === "All" || item.type === flowerTypeFilter;

    const matchesPrice =
      priceFilter === "All" ||
      (priceFilter === "Low" && item.price < 4000) ||
      (priceFilter === "Medium" && item.price >= 4000 && item.price <= 7000) ||
      (priceFilter === "High" && item.price > 7000);

    return matchesSearch && matchesCategory && matchesType && matchesPrice;
  });

  return (
    <div
      className="flowerpage-container"
      style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {/* Navbar */}
{/* Navbar */}
<nav className="navbar">
  <div className="logo-nav-wrapper">
    <img src={logo} alt="Sampaguita Logo" className="logo" />
    <ul className="landing-nav-links">
      <li><Link to="/landingmain" className={location.pathname === "/" ? "active" : ""}>HOME</Link></li>
      <li><Link to="/shop" className={location.pathname === "/shop" ? "active" : ""}>SHOP HERE</Link></li>
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
       <Link to={isLoggedIn ? "/loguser" : "/account"} className="landingmain-link">
  ACCOUNT
</Link>
    </ul>
  </div>
</nav>

    {/* Navbar Icons – moved inside navbar */}
    <div className="flowerpage-navbar-icons">
        <img src={cartIcon} alt="Cart" className="navbar-icon"onClick={goToCart}
              style={{ cursor: 'pointer' }} />
      <img
        src={accountIcon}
        alt="Account"
        className="navbar-icon"
        onClick={handleAccountClick}
        style={{ cursor: "pointer" }}
      />
    </div>
      {/* Filter Bar */}
      <div className="flower-filter-bar">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flower-dropdown"
        >
          <option value="All">CATEGORY ▼</option>
          <option value="Signature Blooms">Signature Blooms</option>
          <option value="Birthday">Birthday</option>
          <option value="Valentine">Valentine</option>
          <option value="Wedding">Wedding</option>
          <option value="Special">Special</option>
        </select>

        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
          className="flower-dropdown"
        >
          <option value="All">PRICE ▼</option>
          <option value="Low">₱0 - ₱3,999</option>
          <option value="Medium">₱4,000 - ₱7,000</option>
          <option value="High">₱7,001 and up</option>
        </select>

        <select
          value={flowerTypeFilter}
          onChange={(e) => setFlowerTypeFilter(e.target.value)}
          className="flower-dropdown"
        >
          <option value="All">FLOWER TYPE ▼</option>
          <option value="Roses">Roses</option>
          <option value="Tulips">Tulips</option>
          <option value="Carnations">Carnations</option>
          <option value="Sunflowers">Sunflowers</option>
        </select>

        <div className="flower-search">
          <input
            type="text"
            placeholder="What are you looking for?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="flower-search-btn">🔍</button>
        </div>
      </div>

      {/* Product Grid */}
{/* Product Grid */}
{filteredFlowers.filter(f => f.category === "Signature Blooms").length > 0 && (
  <>
    <h2 className="flower-section-title">Our Signature Blooms</h2>
    <div className="flower-grid">
      {filteredFlowers
        .filter(f => f.category === "Signature Blooms")
        .map(f => (
          <div key={f._id} className="flower-card">
            <img src={f.img} alt={f.name} className="flower-img" />
            <div className="flower-info">
              <h3>{f.name}</h3>
              <div className="price-view-wrapper">
                <p>₱ {f.price.toLocaleString()}</p>
                 <button
                  className="flower-view-btn"
                  onClick={() => handleViewDetails(f)}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
    </div>
  </>
)}


{filteredFlowers.filter(f => f.category === "Birthday Blooms").length > 0 && (
  <>
   <h2 className="flower-section-title" style={{ marginTop: "60px" }}>
  Birthday Blooms
</h2>
    <div className="flower-grid">
      {filteredFlowers
        .filter(f => f.category === "Birthday Blooms")
        .map(f => (
          <div key={f._id} className="flower-card">
            <img src={f.img} alt={f.name} className="flower-img" />
            <div className="flower-info">
              <h3>{f.name}</h3>
              <div className="price-view-wrapper">
                <p>₱ {f.price.toLocaleString()}</p>
                 <button
                  className="flower-view-btn"
                  onClick={() => handleViewDetails(f)}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
    </div>
  </>
)}
    </div>
  );
};

export default FlowerShopPage;
