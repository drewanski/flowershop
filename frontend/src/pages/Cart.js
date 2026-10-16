import { shoppingStorage, getShoppingScope } from '../shoppingSession';
import { readList, writeList, money, optionText, STORE_EVENT } from '../storeState';
import StoreHeader from '../components/StoreHeader';
import './CoffeeShop.css';
import React, { useEffect, useRef, useState } from "react";
import { FaPlus, FaMinus, FaLocationArrow, FaCoffee, FaArrowRight, FaShoppingBag } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Cart.css";
import { apiRequest } from "../api";
import DeliveryMap from '../components/DeliveryMap';

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    try { return JSON.parse(shoppingStorage.getItem('checkoutAddress') || 'null') || { latitude: '', longitude: '', addressSearch: '', apartmentBuildingLotNumber: '', street: '', barangay: '', city: '', province: '', zipCode: '', riderInstructions: '' }; }
    catch (error) { shoppingStorage.removeItem('checkoutAddress'); return { latitude: '', longitude: '', addressSearch: '', apartmentBuildingLotNumber: '', street: '', barangay: '', city: '', province: '', zipCode: '', riderInstructions: '' }; }
  });
  const [paymentMethod, setPaymentMethod] = useState(() => shoppingStorage.getItem('coffeePaymentMethod') || 'cash');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState(['cash']);
  const [locationMessage, setLocationMessage] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressResults, setAddressResults] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [availableVoucherCampaigns, setAvailableVoucherCampaigns] = useState([]);
  const [claimingVoucherCode, setClaimingVoucherCode] = useState('');
  const [selectedVoucherIds, setSelectedVoucherIds] = useState(() => readList('coffeeSelectedVouchers'));
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherMessage, setVoucherMessage] = useState('');
  const [voucherPreview, setVoucherPreview] = useState(null);
  const [isVoucherPreviewLoading, setIsVoucherPreviewLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [orderNotes, setOrderNotes] = useState(() => shoppingStorage.getItem('coffeeOrderNotes') || '');
  const [manualAddress, setManualAddress] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [locatingAddress, setLocatingAddress] = useState(false);
  const addressSearchRequestId = useRef(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [checkingBag, setCheckingBag] = useState(true);
  const [bagErrors, setBagErrors] = useState([]);
  useEffect(() => { shoppingStorage.setItem('coffeeOrderNotes', orderNotes); }, [orderNotes]);
  useEffect(() => { shoppingStorage.setItem('coffeePaymentMethod', paymentMethod); }, [paymentMethod]);
  useEffect(() => { shoppingStorage.setItem('coffeeSelectedVouchers', JSON.stringify(selectedVoucherIds)); }, [selectedVoucherIds]);
  useEffect(() => {
    let active = true; const stored = readList('cartItems'); setCheckingBag(true); setBagErrors([]);
    if (!stored.length) { setCheckingBag(false); return undefined; }
    (async () => {
      try {
        const ids = [...new Set(stored.map(item => item._id))];
        const responses = await Promise.all(ids.map(id => apiRequest(`/products/${encodeURIComponent(id)}`)));
        if (responses.some(response => !response.ok && response.status !== 404)) throw new Error('Unable to confirm current prices and stock. Refresh your bag to retry.');
        const current = new Map(ids.map((id,index) => [id, responses[index].ok ? responses[index].data?.payload : null]));
        const addonResponse = stored.some(item => item.addons?.length) ? await apiRequest('/products?status=available&isAddon=true') : {ok:true,data:{payload:[]}};
        if (!addonResponse.ok) throw new Error('Unable to confirm add-on availability.');
        const extras = addonResponse.data?.payload || [];
        const errors = [];
        const updated = stored.map(item => {
          const product = current.get(item._id);
          if (!product || product.status !== 'available') { errors.push(`${item.name} is currently unavailable. Remove it from your bag.`); return item; }
          let adjustment = 0;
          const chosen = item.options || [];
          if (chosen.some(option => !(product.optionGroups || []).some(group => group.name === option.name))) errors.push(`Options for ${item.name} changed. Remove it and choose your options again.`);
          for (const group of product.optionGroups || []) {
            const option = chosen.find(option => option.name === group.name);
            const choice = group.choices.find(choice => choice.label === option?.value);
            if ((group.required && !choice) || (option && !choice)) errors.push(`Choose current ${group.name} options for ${item.name} again from the menu.`);
            adjustment += choice?.priceAdjustment || 0;
          }
          const count = stored.filter(entry=>entry._id===item._id).reduce((sum,entry)=>sum+entry.quantity,0);
          if (count > product.stock) errors.push(`Only ${product.stock} ${product.name} available. Reduce your bag quantity.`);
          const updatedAddons = (item.addons || []).map(addon => {
            const live = extras.find(extra=>extra._id===addon._id);
            const rule = (product.allowedAddons || []).find(rule=>String(rule.addon?._id || rule.addon)===addon._id);
            const used = stored.reduce((sum,entry)=>sum+(entry.addons || []).filter(extra=>extra._id===addon._id).reduce((n,extra)=>n+extra.quantity*entry.quantity,0),0);
            if (!live || !rule || addon.quantity > rule.maxQuantity || used > live.stock) errors.push(`${addon.name} is unavailable in the requested quantity. Remove ${item.name} and choose extras again.`);
            return live ? {...addon, price:live.price, stock:live.stock} : addon;
          });
          for (const rule of product.allowedAddons || []) {
            if (rule.minQuantity > ((item.addons || []).find(addon=>addon._id===String(rule.addon?._id || rule.addon))?.quantity || 0)) errors.push(`Required extras for ${item.name} changed. Choose this coffee again.`);
          }
          return {...item, name:product.name, img:product.image, basePrice:product.price, price:Math.round((product.price+adjustment)*100)/100, stock:product.stock, addons:updatedAddons};
        });
        if (!active) return;
        setCartItems(updated); writeList('cartItems',updated); setBagErrors([...new Set(errors)]);
      } catch (error) { if(active) setBagErrors([error.message || 'Unable to confirm current prices. Refresh your bag before checking out.']); }
      finally { if(active) setCheckingBag(false); }
    })();
    return ()=>{active=false;};
  }, [refreshVersion]);
  const locationRequestId = useRef(0);
  const voucherPreviewRequestId = useRef(0);
  const shippingFee = 0;
  const location = useLocation();
  const checkout = location.pathname === '/checkout';
  useEffect(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }, [location.pathname]);
  const navigate = useNavigate();

  // ---------------- Fetch cart from local storage ----------------
  useEffect(() => {
    let storedCart = [];
    try { storedCart = JSON.parse(shoppingStorage.getItem('cartItems') || '[]'); } catch (error) { shoppingStorage.removeItem('cartItems'); }
    setCartItems(Array.isArray(storedCart) ? storedCart : []);
    apiRequest('/payments/methods')
      .then(({ ok, data }) => {
        const methods = ok && Array.isArray(data?.payload) ? data.payload : ['cash'];
        setAvailablePaymentMethods(methods.includes('cash') ? methods : ['cash']);
        if (!methods.includes(paymentMethod)) setPaymentMethod('cash');
      })
      .catch(() => setAvailablePaymentMethods(['cash']));
    if (localStorage.getItem('user_token')) {
      refreshCustomerVouchers();
      refreshAvailableVoucherCampaigns();
    }
  }, []);

  const refreshCustomerVouchers = async () => {
    try {
      const { ok, data } = await apiRequest('/vouchers/customer/mine');
      if (ok && Array.isArray(data?.payload)) {
        const active = data.payload.filter((voucher) => voucher.status === 'active' && new Date(voucher.expiresAt) > new Date());
        setVouchers(active);
        setSelectedVoucherIds((current) => current.filter((id) => active.some((voucher) => voucher._id === id)));
      }
    } catch (error) { return false; }
    return true;
  };

  const refreshAvailableVoucherCampaigns = async () => {
    try {
      const { ok, data } = await apiRequest('/vouchers/customer/available');
      if (ok && Array.isArray(data?.payload)) setAvailableVoucherCampaigns(data.payload);
    } catch (error) { return false; }
    return true;
  };

  useEffect(() => {
    const requestId = ++voucherPreviewRequestId.current;
    if (!selectedVoucherIds.length || !cartItems.length || !localStorage.getItem('user_token')) {
      setVoucherPreview(null);
      setIsVoucherPreviewLoading(false);
      return undefined;
    }
    setIsVoucherPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { ok, data } = await apiRequest('/vouchers/customer/preview', {
          method: 'POST',
          body: JSON.stringify({
            voucherIds: selectedVoucherIds,
            products: cartItems.map((item) => ({ product: item._id, quantity: item.quantity, options: (item.options || []).map(({name,value})=>({name,value})), addons: (item.addons || []).map((addon) => ({ addon: addon._id, quantity: addon.quantity })) })),
          }),
        });
        if (requestId !== voucherPreviewRequestId.current) return;
        if (!ok) throw new Error(data?.message || 'Selected vouchers do not apply to this cart.');
        setVoucherPreview(data?.payload || null);
        setVoucherMessage('');
      } catch (error) {
        if (requestId === voucherPreviewRequestId.current) {
          setVoucherPreview(null);
          setVoucherMessage(error.message || 'Unable to calculate the voucher discount.');
        }
      } finally {
        if (requestId === voucherPreviewRequestId.current) setIsVoucherPreviewLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [cartItems, selectedVoucherIds]);

  useEffect(() => { shoppingStorage.setItem('checkoutAddress', JSON.stringify(deliveryAddress)); }, [deliveryAddress]);

  // ---------------- Helper: Save cart to local storage ----------------
  const saveCartToBackend = async (updatedCart) => {
    writeList('cartItems', updatedCart);
    setRefreshVersion(value => value + 1);
  };

  // ---------------- Quantity controls ----------------
  const handleIncrease = (id) => {
    const updated = cartItems.map((item) => {
      if ((item.cartKey || item._id) === id) {
        const addonsInStock = (item.addons || []).every((addon) => addon.quantity * (item.quantity + 1) <= addon.stock);
        if (item.quantity < item.stock && addonsInStock) return { ...item, quantity: item.quantity + 1 };
        alert("You've reached the maximum stock available!");
      }
      return item;
    });
    setCartItems(updated);
    saveCartToBackend(updated);
  };

  const handleDecrease = (id) => {
    const updated = cartItems.map((item) =>
      (item.cartKey || item._id) === id && item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : item
    );
    setCartItems(updated);
    saveCartToBackend(updated);
  };

  // ---------------- Remove item ----------------
  const handleRemove = (id) => {
    const updated = cartItems.filter((item) => (item.cartKey || item._id) !== id);
    setCartItems(updated);
    saveCartToBackend(updated);
    setCheckoutMessage('');
  };

  const updateDeliveryAddress = (field, value) => {
    if (field !== 'addressSearch') { locationRequestId.current += 1; setLocatingAddress(false); }
    setDeliveryAddress((current) => ({ ...current, formattedAddress: '', [field]: value }));
    setCheckoutMessage('');
  };

  const handleLocationSelected = async ({ latitude, longitude }) => {
    const requestId = ++locationRequestId.current;
    setLocatingAddress(true);
    setDeliveryAddress((current) => ({ ...current, street: '', barangay: '', city: '', province: '', zipCode: '', formattedAddress: '', latitude: Number(latitude).toFixed(6), longitude: Number(longitude).toFixed(6) }));
    setLocationMessage('Pin set. Looking up nearby address details…');
    try {
      const { ok, data } = await apiRequest('/locations/reverse', { method: 'POST', body: JSON.stringify({ latitude: Number(latitude), longitude: Number(longitude) }) });
      if (requestId !== locationRequestId.current) return;
      if (!ok) {
        setLocationMessage(data?.message || 'Pin set. Please complete the address details manually.');
        return;
      }
      const details = data?.payload || {};
      setDeliveryAddress((current) => {
        const next = { ...current, formattedAddress: details.formattedAddress || current.addressSearch || '' };
        ['street', 'barangay', 'city', 'province', 'zipCode'].forEach((field) => {
          if (typeof details[field] === 'string' && details[field].trim()) next[field] = details[field].trim();
        });
        return next;
      });
      const filled = ['street', 'barangay', 'city', 'province'].every((field) => typeof details[field] === 'string' && details[field].trim());
      setLocationMessage(filled ? 'Address filled and map pin updated. Check the drop-off point.' : 'Pin set. Open address correction to complete any missing details.');
    } catch (error) {
      if (requestId === locationRequestId.current) { setLocationMessage('Address lookup failed. Open address correction below to complete the details.'); setManualAddress(true); }
    } finally { if (requestId === locationRequestId.current) setLocatingAddress(false); }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. Choose your delivery point on the map.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        handleLocationSelected({ latitude: coords.latitude, longitude: coords.longitude });
      },
      () => setLocationMessage('Location access was not granted. Search your address or choose the point on the map.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const runAddressSearch = async (query) => {
    const requestId = ++addressSearchRequestId.current;
    if (query.trim().length < 4) { setAddressResults([]); setIsSearchingAddress(false); return; }
    setIsSearchingAddress(true); setLocationMessage('');
    try {
      const { ok, data } = await apiRequest('/locations/geocode', { method: 'POST', body: JSON.stringify({ query: query.trim() }) });
      if (requestId !== addressSearchRequestId.current) return;
      if (!ok) throw new Error(data?.message || 'Address search is unavailable. Drop a pin on the map instead.');
      setAddressResults(data?.payload || []);
      if (!data?.payload?.length) setLocationMessage('No matches found. Include the street, barangay, and city, or place a pin on the map.');
    } catch (error) { if (requestId === addressSearchRequestId.current) { setAddressResults([]); setLocationMessage(error.message); } }
    finally { if (requestId === addressSearchRequestId.current) setIsSearchingAddress(false); }
  };
  useEffect(() => {
    if (!addressQuery) return undefined;
    const timer = setTimeout(() => runAddressSearch(addressQuery), 800);
    return () => clearTimeout(timer);
  }, [addressQuery]);
  const changeAddressSearch = (value) => {
    ++addressSearchRequestId.current; ++locationRequestId.current;
    setLocatingAddress(false); setAddressQuery(value); setAddressResults([]); setLocationMessage('');
    setDeliveryAddress(current=>({...current,addressSearch:value,formattedAddress:'',latitude:'',longitude:'',street:'',barangay:'',city:'',province:'',zipCode:''}));
  };
  const selectAddressResult = (place) => {
    ++addressSearchRequestId.current; setAddressQuery(''); setAddressResults([]); setIsSearchingAddress(false);
    setDeliveryAddress(current=>({...current,addressSearch:place.label,formattedAddress:place.label,street:'',barangay:'',city:'',province:'',zipCode:''}));
    handleLocationSelected({ latitude: place.latitude, longitude: place.longitude });
  };

  const handleCheckout = async (event) => {
    event?.preventDefault();
    setCheckoutMessage('');
    if (checkingBag || bagErrors.length || isVoucherPreviewLoading || locatingAddress) { setCheckoutMessage('Review your bag and resolve availability or pricing issues first.'); return; }
    if (['street','barangay','city','province'].some(field=>!String(deliveryAddress[field] || '').trim())) { setCheckoutMessage('Complete your street, barangay, city, and province before reviewing your order.'); return; }
    const latitude = Number(deliveryAddress.latitude);
    const longitude = Number(deliveryAddress.longitude);
    if (String(deliveryAddress.latitude ?? '').trim() === '' || String(deliveryAddress.longitude ?? '').trim() === '' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setCheckoutMessage('Choose your delivery location by searching an address or dropping the pin on the map.');
      document.querySelector('.checkout-address')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let currentUser;
    try {
      currentUser = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
    } catch (error) {
      localStorage.removeItem('user_currentUser');
    }
    if (!localStorage.getItem('user_token') || currentUser?.role !== 'customer') {
      setCheckoutMessage('Log in or create an account to place your order. Your cart and delivery details will be kept.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (!cartItems.length || isCheckingOut) return;

    if (selectedVoucherIds.length && !voucherPreview) { setCheckoutMessage('Remove vouchers that could not be applied before placing the order.'); return; }
    setIsCheckingOut(true);
    try {
      const { ok, data } = await apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          notes: orderNotes.trim(),
          voucherIds: selectedVoucherIds,
          deliveryAddress: {
            ...deliveryAddress,
            latitude,
            longitude,
          },
          products: cartItems.map((item) => ({
            product: item._id,
            quantity: item.quantity,
            options: (item.options || []).map(({ name, value }) => ({ name, value })),
            addons: (item.addons || []).map((addon) => ({ addon: addon._id, quantity: addon.quantity })),
          })),
        }),
      });

      if (!ok) {
        throw new Error(data?.message || 'Unable to place order.');
      }

      if (paymentMethod === 'online' && data?.payload?.paymentCheckoutUrl) {
        shoppingStorage.setItem('coffeePendingPaymentBag', JSON.stringify({ orderNumber: data.payload.orderNumber, items: shoppingStorage.getItem('cartItems') }));
        window.location.assign(data.payload.paymentCheckoutUrl);
        return;
      }

      shoppingStorage.removeItem('cartItems');
      shoppingStorage.removeItem('coffeeOrderNotes');
      shoppingStorage.removeItem('coffeeSelectedVouchers');
      shoppingStorage.removeItem('coffeePaymentMethod');
      window.dispatchEvent(new Event(STORE_EVENT));
      setCartItems([]);
      shoppingStorage.removeItem('checkoutAddress');
      navigate(`/payment/result?order=${encodeURIComponent(data?.payload?.orderNumber || '')}`);
    } catch (error) {
      setCheckoutMessage(error.message || 'Unable to reach the order service. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const claimVoucher = async (event) => {
    event.preventDefault();
    if (!voucherCode.trim()) return;
    await claimVoucherCode(voucherCode.trim());
  };

  const claimVoucherCode = async (code) => {
    if (!localStorage.getItem('user_token')) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setClaimingVoucherCode(code.toUpperCase());
    try {
      const { ok, data } = await apiRequest('/vouchers/claim', { method: 'POST', body: JSON.stringify({ code }) });
      if (!ok) { setVoucherMessage(data?.message || 'Unable to claim this voucher.'); return; }
      setVoucherCode('');
      setVoucherMessage(data?.message || 'Voucher claimed.');
      await refreshCustomerVouchers();
      await refreshAvailableVoucherCampaigns();
      if (data?.payload?._id) setSelectedVoucherIds((current) => current.includes(data.payload._id) ? current : current.length < 3 ? [...current, data.payload._id] : current);
    } catch (error) {
      setVoucherMessage(error.message || 'Unable to reach the voucher service.');
    } finally {
      setClaimingVoucherCode('');
    }
  };

  // ---------------- Calculate totals ----------------
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity + (item.addons || []).reduce((addonTotal, addon) => addonTotal + addon.price * addon.quantity * item.quantity, 0), 0);
  const summarySubtotal = voucherPreview?.subtotal ?? subtotal;
  const voucherDiscount = voucherPreview?.discount ?? 0;
  const total = (voucherPreview?.total ?? subtotal) + shippingFee;

  const addressText = deliveryAddress.formattedAddress || [deliveryAddress.street,deliveryAddress.barangay,deliveryAddress.city,deliveryAddress.province].filter(Boolean).join(', ');
  const validPin = String(deliveryAddress.latitude ?? '').trim() !== '' && String(deliveryAddress.longitude ?? '').trim() !== '';
  const addressComplete = validPin && ['street','barangay','city','province'].every(field=>String(deliveryAddress[field] || '').trim());
  const blocked = !cartItems.length || checkingBag || !!bagErrors.length || isCheckingOut || locatingAddress || isVoucherPreviewLoading;
  return <div className={`cart-page coffee-compact-cart ${checkout ? 'coffee-checkout-page' : 'coffee-bag-page'}`}>
    <StoreHeader />
    <header className="cart-heading"><div className="cart-heading-copy"><p className="cart-eyebrow">{checkout ? 'THE LAST STEP TO YOUR COFFEE BREAK' : 'A LITTLE PAUSE. YOUR FAVORITE POUR.'}</p><h1 className="cart-title">{checkout ? 'Delivery & checkout' : <>A good day,<br/><em>in your bag.</em></>}</h1><p className="cart-heading-description">{checkout ? 'Confirm your delivery point, review your coffee, and choose how to pay.' : 'Your favorites, just the way you like them. A little closer to your next coffee break.'}</p><nav className="checkout-steps" aria-label="Checkout progress"><Link to="/cart" aria-current={!checkout?'step':undefined}>01 / Your bag</Link><span aria-hidden="true">&rarr;</span><span aria-current={checkout?'step':undefined}>02 / Delivery & checkout</span></nav></div>{!checkout && <div className="cart-heading-stamp" aria-hidden="true"><FaCoffee/><span>A MOMENT<br/>WORTH SIPPING</span></div>}</header>
    <div className="cart-container"><div className="cart-content">
      <main className="cart-main-column">
        <section className="cart-items" aria-label={checkout?'Review your order':'Shopping bag'}>
          <div className="cart-items-heading"><div><span className="cart-section-number">01</span><h2>{checkout ? 'Your order' : 'The good stuff'}</h2></div><span>{cartItems.reduce((sum,item)=>sum+item.quantity,0)} {cartItems.reduce((sum,item)=>sum+item.quantity,0)===1?'item':'items'}</span></div>
          <div className="coffee-bag-status"><span>{checkingBag?'Checking menu prices and stock...':'Prices checked against the current menu'}</span><button type="button" disabled={checkingBag} onClick={()=>setRefreshVersion(value=>value+1)}>Refresh bag</button></div>
          {!!bagErrors.length && <div className="coffee-bag-errors" role="alert">{bagErrors.map(error=><p key={error}>{error}</p>)}</div>}
          {!cartItems.length ? <div className="empty-cart"><span className="cart-empty-icon"><FaShoppingBag/></span><p className="cart-eyebrow">GOOD COFFEE IS CALLING</p><h2>Your next coffee break starts here.</h2><p>Find a comforting classic, a refreshing cold brew, or a blend to bring home.</p><Link className="continue-btn" to="/shop">Find your favorite <FaArrowRight/></Link></div> : cartItems.map(item=><article className="cart-item" key={item.cartKey || item._id}>
            <img src={item.img} alt={item.name} className="cart-img"/><div className="cart-info"><h2><Link to={`/products/${item._id}`}>{item.name}</Link></h2><p className="coffee-cart-options">{optionText(item.options)}</p>{!!item.addons?.length && <p className="cart-extras-copy">{item.addons.map(addon=>`${addon.name} x ${addon.quantity}`).join(' / ')} per coffee</p>}
            <div className="cart-item-bottom">{checkout ? <span>Quantity: {item.quantity}</span> : <div className="qty-box"><button type="button" className="qty-btn" aria-label={`Decrease ${item.name}`} disabled={item.quantity<=1} onClick={()=>handleDecrease(item.cartKey || item._id)}><FaMinus/></button><span>{item.quantity}</span><button type="button" className="qty-btn" aria-label={`Increase ${item.name}`} onClick={()=>handleIncrease(item.cartKey || item._id)}><FaPlus/></button></div>}<strong>{money((item.price+(item.addons || []).reduce((sum,addon)=>sum+addon.price*addon.quantity,0))*item.quantity)}</strong>{!checkout && <button className="remove-btn" onClick={()=>handleRemove(item.cartKey || item._id)}>Remove</button>}</div>
            </div></article>)}
        </section>
        {checkout && <section className="cart-delivery-card"><form className="checkout-address" onSubmit={event=>event.preventDefault()}>
          <div className="delivery-heading"><div><p className="cart-eyebrow"></p><h2>Where should we bring your coffee?</h2></div></div>
          <div className="address-search-form"><label htmlFor="address-search">Delivery address</label><div><input id="address-search" autoComplete="off" maxLength={256} placeholder="House number, street, barangay, city" value={deliveryAddress.addressSearch || ''} onChange={event=>changeAddressSearch(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();setAddressQuery('');runAddressSearch(deliveryAddress.addressSearch || '');}}} aria-controls="delivery-address-results" aria-expanded={!!addressResults.length}/><button type="button" onClick={()=>{setAddressQuery('');runAddressSearch(deliveryAddress.addressSearch || '');}} disabled={isSearchingAddress}>Search</button></div></div>
          {isSearchingAddress && <p role="status" className="location-message">Finding matching addresses...</p>}
          {!!addressResults.length && <div id="delivery-address-results" className="address-results" aria-label="Matching delivery addresses">{addressResults.map((place,index)=><button type="button" key={index} onClick={()=>selectAddressResult(place)}>{place.label}</button>)}</div>}
          <div className="delivery-location-tools"><span>Select a match to fill the address and pin the map.</span><button className="location-button" type="button" onClick={useCurrentLocation}><FaLocationArrow/> Use my location</button></div>
          <DeliveryMap latitude={deliveryAddress.latitude} longitude={deliveryAddress.longitude} onSelect={point=>{setAddressQuery('');setAddressResults([]);setDeliveryAddress(current=>({...current,street:'',barangay:'',city:'',province:'',zipCode:'',formattedAddress:''}));handleLocationSelected(point);}}/>
          {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
          {locatingAddress ? <p className="location-message" role="status">Filling address details from your pin...</p> : validPin && <div className="selected-delivery-address"><b>{addressComplete?'Delivery point selected':'Check this delivery address'}</b><p>{addressText || 'Pin selected on the map.'}</p>{!addressComplete && <small>Some map details are missing. Open address correction below.</small>}</div>}
          <details className="address-correction" open={manualAddress || (validPin && !addressComplete && !locatingAddress)} onToggle={event=>setManualAddress(event.currentTarget.open)}><summary>Correct address details or add a unit / landmark</summary><div className="address-correction-grid">{[['apartmentBuildingLotNumber','Unit / building / lot (optional)'],['street','Street'],['barangay','Barangay'],['city','City or municipality'],['province','Province or region'],['zipCode','ZIP code (optional)'],['riderInstructions','Landmark / delivery instructions (optional)']].map(([field,label])=><label className="checkout-field" key={field}><span>{label}</span><input value={deliveryAddress[field] || ''} onChange={event=>updateDeliveryAddress(field,event.target.value)}/></label>)}</div></details>
          <p className="coordinate-help">Check the map pin for the exact drop-off point. Drag it to adjust. Map data &copy; OpenStreetMap contributors.</p>
          {checkoutMessage && <p className="checkout-message" role="alert">{checkoutMessage}</p>}
        </form></section>}
        {!checkout && <section className="cart-ritual-panel"><img src="/images/products/latte.webp" alt="Freshly poured latte with rosetta art"/><div><p className="cart-eyebrow">MAKE ROOM FOR A LITTLE RITUAL</p><h2>One more reason to slow down.</h2><p>Explore a different brew or bring your favorite blend home.</p><Link to="/shop">Back to the coffee menu <FaArrowRight/></Link></div></section>}
        <Link className="coffee-cart-back" to={checkout?'/cart':'/shop'}>{checkout?'Back to your bag':'Continue shopping'}</Link>
      </main>
      <aside className="cart-summary" aria-label="Order summary"><p className="cart-eyebrow">ORDER SUMMARY</p><h2>{checkout?'One last look.':'Your coffee total'}</h2><p className="summary-line"><span>Items ({cartItems.reduce((sum,item)=>sum+item.quantity,0)})</span><b>{money(summarySubtotal)}</b></p>{voucherDiscount>0&&<p className="summary-line"><span>Voucher discount</span><b>-{money(voucherDiscount)}</b></p>}<p className="summary-line"><span>Delivery</span><b>Free</b></p><p className="summary-line summary-total"><span>Total</span><b>{money(total)}</b></p>
      {checkout ? <>
        <details className="checkout-voucher-details"><summary>Have a voucher?</summary>
            {localStorage.getItem('user_token') && <section className="cart-voucher-offers" aria-labelledby="voucher-offers-heading"><div className="cart-voucher-section-heading"><div><p className="cart-eyebrow">OFFERS FOR YOU</p><h3 id="voucher-offers-heading">Available vouchers</h3></div><button type="button" onClick={() => { refreshAvailableVoucherCampaigns(); refreshCustomerVouchers(); }}>Refresh</button></div>{availableVoucherCampaigns.length ? <div className="cart-voucher-offer-list">{availableVoucherCampaigns.map((offer) => <article className="cart-voucher-offer" key={offer._id}><div className="cart-voucher-offer-copy"><span className="cart-voucher-code">{offer.voucher.code}</span><b>{offer.voucher.name}</b><small>{offer.voucher.discountType === 'percentage' ? `${offer.voucher.discountValue}% off` : `₱${Number(offer.voucher.discountValue).toLocaleString()} off`} · min. spend ₱{Number(offer.voucher.minOrderValue).toLocaleString()} · max ₱{Number(offer.voucher.maxDiscountValue).toLocaleString()}</small>{offer.voucher.newCustomersOnly && <small className="cart-voucher-first-order">First order only · one claim per customer</small>}{offer.eligibilityReason && <small className="cart-voucher-ineligible">{offer.eligibilityReason}</small>}</div><button type="button" onClick={() => claimVoucherCode(offer.voucher.code)} disabled={!offer.claimable || Boolean(claimingVoucherCode)}>{claimingVoucherCode === offer.voucher.code ? 'Claiming…' : offer.claimable ? 'Claim' : 'Not eligible'}</button></article>)}</div> : <p className="voucher-login-note">No new voucher campaigns right now.</p>}</section>}
            {!!vouchers.length && <fieldset className="cart-vouchers"><legend>Your vouchers · select up to 3</legend>{vouchers.map((voucher) => <label key={voucher._id}><input type="checkbox" checked={selectedVoucherIds.includes(voucher._id)} disabled={!selectedVoucherIds.includes(voucher._id) && selectedVoucherIds.length >= 3} onChange={(event) => setSelectedVoucherIds((current) => event.target.checked ? current.length < 3 ? [...current, voucher._id] : current : current.filter((id) => id !== voucher._id))} /><span><b>{voucher.voucher?.name || voucher.voucher?.code}</b><small>{voucher.voucher?.code} · {voucher.voucher?.discountType === 'percentage' ? `${voucher.voucher.discountValue}% off` : `₱${voucher.voucher?.discountValue} off`} · {voucher.voucher?.minOrderValue ? `min. spend ₱${Number(voucher.voucher.minOrderValue).toLocaleString()}` : 'no minimum spend'} · expires {new Date(voucher.expiresAt).toLocaleDateString()}</small>{voucher.voucher?.termsAndConditions && <small>{voucher.voucher.termsAndConditions}</small>}</span></label>)}</fieldset>}
            {localStorage.getItem('user_token') ? <form className="claim-voucher-form" onSubmit={claimVoucher}><label htmlFor="voucher-code">Have a voucher code?</label><div><input id="voucher-code" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} placeholder="Enter a code" /><button type="submit" disabled={!voucherCode.trim()}>Claim</button></div></form> : <p className="voucher-login-note">Log in to claim and use a voucher.</p>}
            {isVoucherPreviewLoading && <p className="voucher-status" role="status">Checking voucher eligibility…</p>}
            {voucherMessage && <p className="voucher-status" role="status">{voucherMessage}</p>}
            {selectedVoucherIds.length > 0 && !isVoucherPreviewLoading && !voucherPreview && <p className="voucher-status voucher-error" role="alert">Selected vouchers could not be applied. Review the message above or remove them.</p>}
            {localStorage.getItem('user_token') && !vouchers.length && <p className="voucher-login-note">Your claimed vouchers will appear here so you can select one for this order.</p>}
            {checkoutMessage && <p role="status" className="checkout-message">{checkoutMessage}</p>}


        </details>
        <div className="checkout-address-summary"><span className="cart-eyebrow">DELIVER TO</span><p>{addressComplete ? addressText : 'Choose your delivery address and map pin to continue.'}</p>{deliveryAddress.apartmentBuildingLotNumber && <small>{deliveryAddress.apartmentBuildingLotNumber}</small>}{deliveryAddress.riderInstructions && <small>{deliveryAddress.riderInstructions}</small>}</div>
        <fieldset className="checkout-payment"><legend>Payment method</legend>{availablePaymentMethods.includes('cash')&&<label><input type="radio" name="payment" value="cash" checked={paymentMethod==='cash'} onChange={()=>setPaymentMethod('cash')}/><span><b>Cash on delivery</b><small>Pay the rider when your coffee arrives.</small></span></label>}{availablePaymentMethods.includes('online')&&<label><input type="radio" name="payment" value="online" checked={paymentMethod==='online'} onChange={()=>setPaymentMethod('online')}/><span><b>Pay online</b><small>Card, GCash, or QR Ph through PayMongo.</small></span></label>}</fieldset>
        <label className="checkout-field checkout-barista-note"><span>A note for the barista (optional)</span><textarea rows={2} maxLength={500} value={orderNotes} placeholder="Any extra preparation requests?" onChange={event=>setOrderNotes(event.target.value)}/></label>
        {checkoutMessage && <p className="checkout-message" role="alert">{checkoutMessage}</p>}
        <button type="button" className="checkout-btn" disabled={blocked || !addressComplete || (selectedVoucherIds.length>0&&!voucherPreview)} onClick={event=>handleCheckout(event)}>{isCheckingOut?'Placing order...':paymentMethod==='cash'?'Place order':'Continue to secure payment'}</button><p className="note">{paymentMethod==='cash'?'Your order is sent to the shop when you place it.':'You will enter payment details on the secure PayMongo page.'}</p>
      </> : <><div className="cart-checkout-note"><FaCoffee/><p>Your next sip is one step away.<small>Add your delivery details and choose payment at checkout.</small></p></div><button className="checkout-btn cart-checkout-link" type="button" disabled={blocked} onClick={()=>getShoppingScope().startsWith('customer:') ? navigate('/checkout') : navigate('/login', {state:{from:'/checkout'}})}>Continue to checkout <FaArrowRight/></button><p className="cart-summary-caption">Review everything before you place your order.</p></>}
      </aside>
    </div></div>
  </div>;
}
