import { getShoppingScope } from '../shoppingSession';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiMinus, FiPlus, FiHeart, FiShoppingBag } from 'react-icons/fi';
import StoreHeader from '../components/StoreHeader';
import { apiRequest } from '../api';
import { readList, writeList, money } from '../storeState';
import './CoffeeShop.css';
export default function ViewDetails() {
  const { productId } = useParams();
  const location = useLocation(); const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1); const [choices, setChoices] = useState({});
  const [addons, setAddons] = useState([]); const [addonQuantities, setAddonQuantities] = useState({});
  const [saved, setSaved] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setMessage(''); setQuantity(1); setAddons([]); setAddonQuantities({});
    let legacy; try { legacy = JSON.parse(localStorage.getItem('selectedFlower') || 'null'); } catch { legacy = null; }
    const id = productId || location.state?.product?._id || location.state?.flower?._id || legacy?._id;
    if (!id) { setError('Choose a coffee from the menu first.'); setLoading(false); return undefined; }
    (async () => {
      try {
        const { ok, data } = await apiRequest(`/products/${encodeURIComponent(id)}`);
        if (!ok || !data?.payload || data.payload.isAddon) throw new Error(data?.message || 'This coffee is unavailable.');
        if (!active) return;
        const item = data.payload; setProduct(item);
        setChoices(Object.fromEntries((item.optionGroups || []).map(group => [group.name, group.required ? group.choices[0]?.label || '' : ''])));
        setSaved(readList('wishlistItems').some(saved => saved._id === item._id));
        if (item.allowedAddons?.length) {
          const response = await apiRequest('/products?status=available&isAddon=true');
          if (!active) return;
          if (!response.ok) throw new Error('Unable to load coffee add-ons. Please try again.');
          setAddons(Array.isArray(response.data?.payload) ? response.data.payload : []);
          setAddonQuantities(Object.fromEntries(item.allowedAddons.map(rule => [String(rule.addon?._id || rule.addon), rule.minQuantity])));
        }
      } catch (failure) { if (active) setError(failure.message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [productId, location.state]);
  const groups = product?.optionGroups || [];
  const selectedOptions = groups.filter(group => choices[group.name]).map(group => ({ name: group.name, value: choices[group.name], priceAdjustment: group.choices.find(choice => choice.label === choices[group.name])?.priceAdjustment || 0 }));
  const optionPrice = selectedOptions.reduce((sum, choice) => sum + choice.priceAdjustment, 0);
  const selectedAddons = (product?.allowedAddons || []).map(rule => {
    const id = String(rule.addon?._id || rule.addon); const addon = addons.find(addon => addon._id === id);
    return addon && addonQuantities[id] > 0 ? { _id: addon._id, name: addon.name, price: addon.price, quantity: addonQuantities[id], stock: addon.stock } : null;
  }).filter(Boolean);
  const unitPrice = (product?.price || 0) + optionPrice;
  const total = (unitPrice + selectedAddons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0)) * quantity;
  const available = product?.status === 'available' && product?.stock > 0;
  const ready = groups.every(group => !group.required || choices[group.name]) && (product?.allowedAddons || []).every(rule => {
    const id = String(rule.addon?._id || rule.addon); const value = addonQuantities[id] || 0; const addon = addons.find(addon => addon._id === id);
    return value >= rule.minQuantity && value <= rule.maxQuantity && (!value || (addon && value * quantity <= addon.stock));
  });
  function addToCart() {
    if (getShoppingScope() === 'staff') { setMessage('Please use a customer account to add coffee to a shopping bag.'); return; }
    if (!available || !ready) return;
    const cart = readList('cartItems');
    const mainCount = cart.filter(item => item._id === product._id).reduce((sum, item) => sum + item.quantity, 0);
    if (mainCount + quantity > product.stock) { setMessage('Your bag already contains the remaining stock of this coffee. Reduce the quantity or edit your bag.'); return; }
    for (const addon of selectedAddons) {
      const reserved = cart.reduce((sum, item) => sum + (item.addons || []).filter(entry => entry._id === addon._id).reduce((n, entry) => n + entry.quantity * item.quantity, 0), 0);
      if (reserved + addon.quantity * quantity > addon.stock) { setMessage(`${addon.name} does not have enough stock for your whole bag.`); return; }
    }
    const cartKey = JSON.stringify([product._id, selectedOptions.map(option => [option.name, option.value]), selectedAddons.map(addon => [addon._id, addon.quantity]).sort()]);
    const existing = cart.find(item => item.cartKey === cartKey);
    if (existing) existing.quantity += quantity;
    else cart.push({ _id: product._id, cartKey, name: product.name, price: unitPrice, basePrice: product.price, options: selectedOptions, quantity, img: product.image, stock: product.stock, addons: selectedAddons });
    writeList('cartItems', cart); navigate('/cart');
  }
  function toggleSaved() {
    const list = readList('wishlistItems'); writeList('wishlistItems', saved ? list.filter(item => item._id !== product._id) : [...list, { _id: product._id, name: product.name, image: product.image, price: product.price }]);
    setSaved(!saved); setMessage(saved ? 'Removed from favorites.' : 'Saved to your favorites.');
  }
  return <div className="coffee-site"><StoreHeader /><main className="coffee-product-page"><nav className="coffee-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/shop">Menu</Link><span>/</span><span>{product?.name || 'Coffee details'}</span></nav>
    {loading ? <p role="status">Loading your coffee...</p> : error ? <div role="alert"><h1>Let us try another cup.</h1><p>{error}</p><Link className="coffee-button" to="/shop">Back to the menu</Link></div> : product && <div className="coffee-product-layout"><div className="coffee-product-visual"><img src={product.image} alt={product.name} /><p>Made for your everyday coffee ritual.</p></div><div className="coffee-product-copy"><p className="coffee-eyebrow">{product.category}</p><h1>{product.name}</h1><p className="coffee-product-price">{money(unitPrice)} <small>per {product.category === 'Coffee Beans' ? 'bag' : 'cup'}</small></p><span className={`coffee-stock ${available ? '' : 'sold-out'}`}>{available ? 'Available to order' : 'Currently unavailable'}</span><p className="coffee-product-description">{product.description}</p>
    <div className="coffee-options">{groups.map(group => <fieldset key={group.name}><legend>{group.name} <small>{group.required ? 'Choose one' : 'Optional'}</small></legend><div className="coffee-choice-row">{!group.required && <button type="button" aria-pressed={!choices[group.name]} onClick={()=>setChoices({...choices,[group.name]:''})}>None</button>}{group.choices.map(choice => <button type="button" key={choice.label} aria-pressed={choices[group.name]===choice.label} onClick={()=>setChoices({...choices,[group.name]:choice.label})}>{choice.label}{choice.priceAdjustment > 0 && <small>+{money(choice.priceAdjustment)}</small>}</button>)}</div></fieldset>)}</div>
    {!!product.allowedAddons?.length && <section className="coffee-extras" aria-label="Coffee extras"><h2>A little extra?</h2>{product.allowedAddons.map(rule => { const id=String(rule.addon?._id || rule.addon); const addon=addons.find(addon=>addon._id===id); const value=addonQuantities[id]||0; if(!addon) return <p key={id}>{rule.minQuantity ? 'A required extra is unavailable.' : 'One optional extra is unavailable.'}</p>; return <div className="coffee-extra-row" key={id}><div><b>{addon.name}</b><small>{money(addon.price)} each / {rule.minQuantity ? `Minimum ${rule.minQuantity}` : 'Optional'}</small></div><div className="coffee-stepper"><button type="button" aria-label={`Remove ${addon.name}`} disabled={value<=rule.minQuantity} onClick={()=>setAddonQuantities({...addonQuantities,[id]:value-1})}><FiMinus /></button><span>{value}</span><button type="button" aria-label={`Add ${addon.name}`} disabled={value>=Math.min(rule.maxQuantity,Math.floor(addon.stock/quantity))} onClick={()=>setAddonQuantities({...addonQuantities,[id]:value+1})}><FiPlus /></button></div></div>; })}</section>}
    <div className="coffee-order-total"><span>Your selection / {quantity} {quantity===1?'item':'items'}</span><strong>{money(total)}</strong></div><div className="coffee-product-actions"><div className="coffee-stepper"><button type="button" aria-label="Decrease quantity" disabled={quantity<=1} onClick={()=>setQuantity(quantity-1)}><FiMinus /></button><span>{quantity}</span><button type="button" aria-label="Increase quantity" disabled={!available || quantity>=product.stock} onClick={()=>setQuantity(quantity+1)}><FiPlus /></button></div><button className="coffee-button" disabled={!available || !ready} onClick={addToCart}><FiShoppingBag />{available ? ready ? 'Add to bag' : 'Review your extras' : 'Sold out'}</button><button className="coffee-save-button" aria-label={saved?'Remove from favorites':'Save to favorites'} aria-pressed={saved} onClick={toggleSaved}><FiHeart /></button></div><p role="status">{message}</p><p className="coffee-product-help">Available options and extras are listed above. For ingredient or allergy questions, <Link to="/#contact">contact us before ordering</Link>.</p></div></div>}
  </main></div>;
}
