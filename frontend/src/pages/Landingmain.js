import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Landingmain.css";
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';


// Assets
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";  
import bottomhalf from "../assets/bottomhalf.png";
import bottomhalfabt from "../assets/bottomhalf.png";
import middletext from "../assets/middletext.png";
import bottomflower from "../assets/bottomflower.png";
import cartIcon from "../assets/crtlogo.png";
import accountIcon from "../assets/acntlogo.png";
import leftImage from "../assets/Lampshade.png";
import abtt from "../assets/abttext.png";
import hous from "../assets/house.png";
import flowerTop from "../assets/abttlogo.png";
import foeter from "../assets/footer.png";
import leftImageForContact from "../assets/phone.png";
import ctntxt from "../assets/conttxt.png";
import { apiRequest } from "../api";


export default function Landingmain() {
  const [activeSection, setActiveSection] = useState("home");
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
const [isLoggedIn, setIsLoggedIn] = useState(false);

useEffect(() => {
  const currentUser = localStorage.getItem("user_currentUser");
  const isLoggedInFlag = localStorage.getItem("user_isLoggedIn");
  setIsLoggedIn(currentUser && isLoggedInFlag === "true");
}, []);


  // for scrolling to section when clicking nav links with hashes
useEffect(() => {
  if (location.pathname === "/landingmain" && location.hash) {
    const section = document.querySelector(location.hash);
    if (section) {
      setTimeout(() => {
        section.scrollIntoView({ behavior: "smooth" });
      }, 0);
    }
  }
}, [location.pathname, location.hash]);

useEffect(() => {
  if (location.state?.scrollTo) {
    const section = document.getElementById(location.state.scrollTo);
    if (section) {
      setTimeout(() => section.scrollIntoView({ behavior: "smooth" }), 0);
    }
  }
}, [location.state]);

  const navigate = useNavigate();
  
  
    const handleClick = () => {
    navigate('/shop'); // Same route as nav
  };
  const handleAccountClick = () => {
    const currentUser = localStorage.getItem("user_currentUser");
    const isLoggedInFlag = localStorage.getItem("user_isLoggedIn");
    const loggedIn = currentUser && isLoggedInFlag === "true";

    navigate(loggedIn ? "/loguser" : "/account");
  };


   const goToCart = () => {
    navigate("/cart");
  };

    // for scrolling to section when clicking nav links in the same page
  useEffect(() => {
  const handleScroll = () => {
    const homeSection = document.getElementById("home");
    const aboutSection = document.getElementById("about");
    const contactSection = document.getElementById("contact");

    
    const scrollY = window.scrollY;

    if (contactSection && scrollY >= contactSection.offsetTop - window.innerHeight / 3) {
      setActiveSection("contact");
    } else if (aboutSection && scrollY >= aboutSection.offsetTop - window.innerHeight / 3) {
      setActiveSection("about");
    } else {
      setActiveSection("home");
    }

    setIsScrolled(scrollY > 50);
  };


  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);

// Database connection for contact form
const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = { name, email, message };

    try {
      const { ok, data: result } = await apiRequest('/contact', {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (ok) {
        alert("✅ Message sent successfully!");
        console.log("✅ Server response:", result);

        // Clear form
        setName("");
        setEmail("");
        setMessage("");
      } else {
        alert(`❌ Error: ${result?.message || "Failed to send message"}`);
        console.error("Error response:", result);
      }
    } catch (err) {
      console.error("❌ Error sending message:", err);
      alert("⚠️ Unable to reach the server. Check backend connection.");
    }
  };

  return (
    <>
    
              <img src={logo} alt="Sampaguita Logo" className="landingmain-logo" />
      <div id="home"
        className="landingmain"
        style={{ backgroundImage: `url(${bg})` }}
      >
<nav
  className={`landingmain-navbar 
    ${isScrolled ? "scrolled" : ""} 
    ${activeSection === "about" ? "navbar-white-text" : ""}
    ${activeSection === "contact" ? "landingmain-contact-nav" : ""}`}
>
  <ul className="landingmain-nav-links">
    <li>
      <a
        href="#home"
        className={`landingmain-link ${activeSection === "home" ? "active" : ""}`}
      >
        HOME
      </a>
    </li>

    <li>
      <Link to="/shop" className="landingmain-link">
        SHOP HERE
      </Link>
    </li>

    <li>
      <a
        href="#about"
        className={`landingmain-link ${activeSection === "about" ? "active" : ""}`}
      >
        ABOUT US
      </a>
    </li>

    <li>
      <a
        href="#contact"
        className={`landingmain-link ${activeSection === "contact" ? "active" : ""}`}
      >
        CONTACT
      </a>
    </li>

    <li>
       <a href="#" onClick={handleAccountClick} className="landingmain-link">
    ACCOUNT
  </a>
    </li>
  </ul>
</nav>


    <div className="landingmain-navbar-icons" >
            <img src={cartIcon} alt="Cart" className="navbar-icon"onClick={goToCart}
        style={{ cursor: 'pointer' }} />
            <img
        src={accountIcon}
        alt="Account"
        className="navbar-icon"
        onClick={handleAccountClick}
        style={{ cursor: 'pointer' }}
      />
          </div>

  
        <div className="landingmain-grace">
          <img src={middletext} alt="Timeless Petals, Enduring Grace" />
        </div>

        <div className="landingmain-cta-buttons">
          <button className="cta-solid-btn" onClick={handleClick}>
          Shop Now
        </button>
          <button
  className="cta-outline-btn"
  onClick={() => {
    const section = document.getElementById('about');
    section?.scrollIntoView({ behavior: 'smooth' });
  }}
>
  Learn More
</button>

        </div>

        <div className="landingmain-paragraph">
          <p>
            At Sampaguita de Salva, we believe flowers are more than just gifts —
            they’re timeless expressions of love, joy, and beauty. Whether it’s
            for a grand celebration, a heartfelt gesture, or simply to brighten
            an ordinary day, our blooms carry heritage, elegance, and grace in
            every petal. With us, every moment becomes more meaningful, every
            day more radiant.
          </p>
        </div>

        <div className="landingmain-bottom-img">
          <img src={bottomhalf} alt="Bottom decoration" />
        </div>

        <div className="landingmain-bottom-right-flower">
          <img src={bottomflower} alt="Decorative flower" />
        </div>
      </div>
      <section id="about" className="landingmain-scrollable"  style={{ backgroundImage: `url(${bg})` }}>
        <div className="landingmain-left-overlay">
        <img src={leftImage} alt="Left decorative" />
      </div>


<div className="landingmain-left-overlay-above">
  <img src={flowerTop} alt="Top decoration above abtt" />
</div>
<div className="landingmain-left-overlay-three">
  <img src={hous} alt="House decorative" />
</div>

  <div className="landingmain-left-overlay-two">
    <img src={abtt} alt="Left decoration 2" />
  </div>


      <div className="landingmain-bottom-abt">
        <img src={bottomhalfabt} alt="Bottom design" />
      </div>
    </section>

<section id="contact" className="landingmain-scrollable landingmain-contact" style={{ backgroundImage: `url(${bg})` }}>
    <div className="landingmain-contact-left-overlay">
    <img src={leftImageForContact} alt="Left decorative" />
  </div>
 <div className="landingmain-contact-right-overlay">
        <img src={ctntxt} alt="Right decorative" />
      </div>
        <div className="landing-contact-form-wrapper">
   <form className="landing-contact-formbox" onSubmit={handleSubmit}>
      <div className="landing-contact-input-rowbox">
        <div className="landing-contact-input-withicon">
          <i className="fa fa-user"></i>
          <input
            type="text"
            placeholder="Name"
            className="landing-contact-inputbox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="landing-contact-input-withicon">
          <i className="fa fa-envelope"></i>
          <input
            type="email"
            placeholder="Email"
            className="landing-contact-inputbox"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <textarea
        placeholder="Type your message here..."
        className="landing-contact-messagebox"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      ></textarea>

      <button type="submit" className="landing-contact-submitbtnbox">
        SUBMIT
      </button>
    </form>
  </div>
  <div className="landingmain-contact-bottom-image">
    <img src={foeter} alt="Decorative bottom" />
  </div>
</section>
    </>

  );
}
