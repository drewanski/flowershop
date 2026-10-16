import { getShoppingScope } from '../shoppingSession';
import { roleHome } from '../roleAccess';
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FiShoppingBag, FiUser, FiCoffee, FiHeart } from 'react-icons/fi';
import logo from '../assets/coffee-logo.svg';
import { readList, STORE_EVENT } from '../storeState';
export default function StoreHeader() {
  const location = useLocation();
  const isStaff = getShoppingScope() === 'staff';
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readList('cartItems').reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0));
    update(); window.addEventListener(STORE_EVENT, update); window.addEventListener('storage', update);
    return () => { window.removeEventListener(STORE_EVENT, update); window.removeEventListener('storage', update); };
  }, [location.pathname]);
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user_currentUser') || 'null'); } catch {}
  const account = localStorage.getItem('user_token') && user ? roleHome(user.role) : '/login';
  return <><div className="coffee-announcement"><FiCoffee /> A little pause. A better cup. Coffee, delivered.</div><header className="coffee-header"><Link to="/" aria-label="Kape & Co. home"><img src={logo} alt="Kape & Co." /></Link><nav aria-label="Main navigation"><NavLink to="/" end>Home</NavLink><NavLink to="/shop">Our menu</NavLink><Link to="/#about">Our story</Link><Link to="/#contact">Contact</Link></nav><div className="coffee-header-actions">{!isStaff && <Link to="/wishlist" aria-label="Saved favorites"><FiHeart /></Link>}<Link to={account} aria-label="My account"><FiUser /></Link>{!isStaff && <Link className="coffee-bag-link" to="/cart" aria-label={`Shopping bag, ${count} items`}><FiShoppingBag />{!!count && <span className="coffee-bag-count">{count}</span>}</Link>}<Link className="coffee-button small" to="/shop">Order coffee &#8599;</Link></div></header></>;
}
