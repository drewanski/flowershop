import React from 'react';
import { Link } from 'react-router-dom';
import StoreHeader from '../components/StoreHeader';
import './CoffeeShop.css';
export default function Landinglog() { return <div className="coffee-site"><StoreHeader /><main className="coffee-account"><img src="/images/products/latte.webp" alt="A comforting cup of coffee" /><div><p className="coffee-eyebrow">YOUR COFFEE CORNER</p><h1>A warm welcome.<br />Your usual awaits.</h1><p>Sign in to order your favorites, save your wishlist, claim vouchers, and keep track of your deliveries.</p><div className="coffee-hero-actions"><Link className="coffee-button" to="/login">Log in ↗</Link><Link className="coffee-text-link" to="/signup">Create an account</Link></div></div></main></div>; }
