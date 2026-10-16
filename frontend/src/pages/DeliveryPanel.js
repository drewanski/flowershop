import { clearSession } from '../shoppingSession';
import { statusLabels, paymentLabel, addressLabel } from '../orderWorkflow';
import OrderLines from '../components/OrderLines';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../api';
import logo from '../assets/coffee-logo.svg';
import './DeliveryPanel.css';

export default function DeliveryPanel() {
  const [view, setView] = useState('available');
  const location = useLocation();
  useEffect(() => { const target = new URLSearchParams(location.search).get('view'); if (['mine', 'available'].includes(target)) setView(target); }, [location.search]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy,setBusy]=useState('');
  const navigate = useNavigate();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = view === 'available' ? '/orders/delivery/available' : '/orders/delivery/mine';
      const { ok, data } = await apiRequest(path);
      if (!ok) throw new Error(data?.message || 'Unable to load deliveries.');
      setOrders(Array.isArray(data?.payload) ? data.payload : []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load deliveries.');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => { loadOrders();const timer=setInterval(()=>{if(document.visibilityState==='visible')loadOrders();},30000);return()=>clearInterval(timer); }, [loadOrders, location.search]);

  const runAction = async (order, action) => {
    if(busy)return;setBusy(order._id);
    try {
      const { ok, data } = await apiRequest(`/orders/delivery/${order._id}/${action}`, { method: 'POST' });
      if (!ok) {
        setError(data?.message || 'Unable to update delivery.');
        return;
      }
      await loadOrders();
    } catch (actionError) {
      setError(actionError.message || 'Unable to update delivery.');
    } finally {setBusy('');}
  };

  const logout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <main className="delivery-workspace">
      <header className="delivery-header">
        <img src={logo} alt="Kape & Co." />
        <div className="delivery-header-actions">
          <span>Delivery workspace</span>
          <button type="button" onClick={logout}>Log out</button>
        </div>
      </header>
      <section className="delivery-content">
        <div className="delivery-title-row">
          <div>
            <p className="delivery-eyebrow">FULFILLMENT</p>
            <h1>Deliveries</h1>
          </div>
          <button className="delivery-refresh" type="button" onClick={loadOrders} disabled={loading}>Refresh</button>
        </div>
        <div className="delivery-tabs" role="tablist" aria-label="Delivery lists">
          <button type="button" role="tab" aria-selected={view === 'available'} className={view === 'available' ? 'selected' : ''} onClick={() => setView('available')}>Available</button>
          <button type="button" role="tab" aria-selected={view === 'mine'} className={view === 'mine' ? 'selected' : ''} onClick={() => setView('mine')}>Assigned to me</button>
        </div>
        {error && <p className="delivery-error" role="alert">{error}</p>}
        {loading ? <p className="delivery-empty">Loading deliveries…</p> : orders.length === 0 ? (
          <p className="delivery-empty">{view === 'available' ? 'No deliveries are ready to claim.' : 'You have no assigned deliveries.'}</p>
        ) : (
          <div className="delivery-list">
            {orders.map((order) => (
              <article className="delivery-order" key={order._id}>
                <div className="delivery-order-heading">
                  <div><p className="delivery-order-number">{order.orderNumber}</p><p className="delivery-order-date">{new Date(order.createdAt).toLocaleString()}</p></div>
                  <span className={`delivery-status status-${order.status}`}>{statusLabels[order.status] || order.status}</span>
                </div>
                <p className="delivery-customer">{order.user?.firstName} {order.user?.lastName} · {order.user?.contactNumber}</p>
                <p className="delivery-address">{addressLabel(order.deliveryAddress)}</p><p className="delivery-instructions">{paymentLabel(order)}</p>
                {order.deliveryAddress?.riderInstructions && <p className="delivery-instructions">Note: {order.deliveryAddress.riderInstructions}</p>}
                <OrderLines order={order} />
                <div className="delivery-order-footer">
                  <strong>₱ {(Number(order.grandTotal) || 0).toLocaleString()}</strong>
                  {view === 'available' && <button type="button" disabled={!!busy} onClick={() => runAction(order, 'claim')}>Claim delivery</button>}
                  {view === 'mine' && order.status === 'claimed' && <button type="button" disabled={!!busy} onClick={() => runAction(order, 'ship')}>Start delivery</button>}
                  {view === 'mine' && order.status === 'shipped' && <button type="button" disabled={!!busy} onClick={() => runAction(order, 'deliver')}>Mark delivered</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
