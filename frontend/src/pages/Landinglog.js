import "./Landinglog.css";
import { Link,  useNavigate, useLocation } from "react-router-dom";
//assets
import logo from "../assets/logo_a.png";
import bg from "../assets/background.png";  
import heroImg from "../assets/hewo.png";

export default function Landinglog() {
    const navigate = useNavigate();
const location = useLocation();
   const goToCart = () => {
    navigate("/cart");
  };
// Helper function to scroll via state
const scrollToSection = (sectionId) => {
  navigate("/landingmain", { state: { scrollTo: sectionId } });
};

const handleAccountClick = () => {
  const isLoggedIn = localStorage.getItem("user_isLoggedIn");  // ✅ match login key
  const currentUser = localStorage.getItem("user_currentUser"); // ✅ optional check

  if (currentUser && isLoggedIn === "true") {
    // You can keep these if your app uses them
    localStorage.setItem("currentUserEmail", localStorage.getItem("currentUserEmail") || "");
    localStorage.setItem("currentUserType", localStorage.getItem("currentUserType") || "user");

    navigate('/userinfo');
  } else {
    navigate('/login');
  }
};

return (
   
<div 
className="landing"
style={{ backgroundImage: `url(${bg})` }}
>
<nav className="landing-navbar fade-in-up">
    <div className="logo-nav-wrapper">
        <img src={logo} alt="Sampaguita Logo" className="logo" />
        <ul className="landing-nav-links">
            <li>
                <Link to="/landingmain">
                HOME</Link>
            </li>
            <li>
                <Link to="/shop"className="landingmain-link">
                SHOP HERE</Link>
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
                 <a href="#" onClick={handleAccountClick} className="landingmain-link">
    ACCOUNT
  </a>
            </li>
        </ul>
    </div>
    <div className="nav-buttons">
        <Link to="/login">
        <button className="btn-outline">Log In</button>
        </Link>
        <Link to="/signup">
        <button className="btn-solid">Get Started for Free</button>
        </Link>
    </div>
</nav>
<div className="hero">
    <div className="hero-text fade-in-up hero-text">
        <h1>STAY AT HOME<br />AND SHOP ONLINE</h1>
        <p>Giving you shopping convenience between your hectic schedule,</p>
        <p>so you can save time and be safe.</p>
        <div className="hero-button">
            <Link to="/signup">
            <button className="btn-solid1">Get Started for Free</button>
            </Link>
        </div>
    </div>
    <div className="hero-img-container fade-in-up hero-img-container">
        <img src={heroImg} alt="Shopping illustration" />
    </div>
</div>
</div>
);
}