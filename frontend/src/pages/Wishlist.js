import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StoreHeader from '../components/StoreHeader';
import { apiRequest } from '../api';
import { readList, writeList } from '../storeState';
import { money } from '../storeState';
import './CoffeeShop.css';
export default function Wishlist() {
  const [saved,setSaved]=useState(()=>readList('wishlistItems'));
  const [catalog,setCatalog]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{let active=true;apiRequest('/products?status=available&isAddon=false').then(({ok,data})=>{if(!ok)throw new Error('Current availability could not be loaded.');if(active)setCatalog(Array.isArray(data?.payload)?data.payload:[]);}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[]);
  const remove=id=>{const next=saved.filter(item=>item._id!==id);setSaved(next);writeList('wishlistItems',next);};
  return <div className="coffee-site"><StoreHeader /><main className="coffee-menu-page"><div className="coffee-menu-heading"><p className="coffee-eyebrow">SAVE A LITTLE SOMETHING FOR LATER</p><h1>Your favorites.</h1><p>Your saved coffees stay in this browser for your next visit.</p></div>{error&&<p role="alert">{error} Product details show the latest price and stock.</p>}{!saved.length?<div className="coffee-empty-state"><h2>Your next favorite is waiting.</h2><p>Tap the heart on any coffee to save it here.</p><Link className="coffee-button" to="/shop">Explore the menu</Link></div>:<div className="coffee-menu-grid">{saved.map(item=>{const current=catalog?.find(product=>product._id===item._id);const product=current||item;return <article className="coffee-menu-card" key={item._id}><Link to={`/products/${item._id}`} className="coffee-menu-image"><img src={product.image} alt={product.name}/></Link><div className="coffee-menu-card-copy"><h3>{product.name}</h3><p>{catalog&&!current?'Currently unavailable':money(product.price)}</p><Link className="coffee-card-order" to={`/products/${item._id}`}>View coffee & options</Link><button className="coffee-remove-favorite" onClick={()=>remove(item._id)}>Remove from favorites</button></div></article>;})}</div>}</main></div>;
}
