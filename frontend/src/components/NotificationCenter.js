import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiX, FiCheck } from 'react-icons/fi';
import { apiRequest } from '../api';
import { STORE_EVENT } from '../shoppingSession';
import './NotificationCenter.css';

function currentSession() {
  try {
    const user = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
    const token = localStorage.getItem('user_token');
    return user && token ? { user, key: `${user._id}:${user.role}:${token}` } : null;
  } catch { return null; }
}
export const notificationPath = (user, item) => user.role === 'customer'
  ? `/loguser?order=${encodeURIComponent(item.order)}#order-${item.order}`
  : user.role === 'delivery'
  ? `/delivery?view=${item.deliveryView === 'available' ? 'available' : 'mine'}&order=${encodeURIComponent(item.order)}`
  : `/adminpanel?order=${encodeURIComponent(item.orderNumber)}`;

export default function NotificationCenter() {
  const [session, setSession] = useState(currentSession);
  useEffect(() => {
    const update = () => setSession(currentSession());
    window.addEventListener(STORE_EVENT, update); window.addEventListener('storage', update);
    return () => { window.removeEventListener(STORE_EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return session ? <Inbox key={session.key} user={session.user} /> : null;
}
function Inbox({ user }) {
  const [items, setItems] = useState([]), [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false), [toast, setToast] = useState(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [next, setNext] = useState(null);
  const mounted = useRef(true), latest = useRef(null), pending = useRef(false), refresh = useRef(null);
  const panel = useRef(null), bell = useRef(null), navigate = useNavigate();
  useEffect(() => {
    let active = true; mounted.current = true;
    const load = async () => {
      if (pending.current || document.visibilityState === 'hidden') return;
      pending.current = true;
      try {
        const { ok, data } = await apiRequest('/notifications');
        if (!ok) throw new Error(data?.message || 'Unable to load notifications.');
        if (!active) return;
        const page = data.payload;
        const newest = page.items[0];
        if (latest.current && newest && newest._id > latest.current && !newest.readAt) setToast(newest);
        if (newest) latest.current = newest._id;
        else if (!latest.current) latest.current = '0';
        setItems(page.items); setUnread(page.unreadCount); setNext(page.nextCursor); setError('');
      } catch (e) { if (active) setError(e.message); }
      finally { pending.current = false; if (active) setLoading(false); }
    };
    refresh.current = load; load();
    const timer = setInterval(load, 10000);
    const show = () => { setOpen(true); load(); };
    window.addEventListener('focus', load); document.addEventListener('visibilitychange', load);
    window.addEventListener('coffee-open-notifications', show);
    return () => { active = false; mounted.current = false; clearInterval(timer); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', load); window.removeEventListener('coffee-open-notifications', show); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 8000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (open) panel.current?.focus();
    const escape = e => { if (e.key === 'Escape') { setOpen(false); bell.current?.focus(); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [open]);
  const act = async (path, body, onSuccess) => {
    if (busy) return; setBusy(true);
    try { const { ok, data } = await apiRequest(path, { method: 'PATCH', body: JSON.stringify(body || {}) }); if (!ok) throw new Error(data?.message || 'Unable to update notifications.'); if (!mounted.current) return; onSuccess?.(); await refresh.current(); }
    catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const visit = item => act(`/notifications/${item._id}/read`, {}, () => { setOpen(false); setToast(null); navigate(notificationPath(user, item)); });
  const older = async () => {
    if (busy || !next) return; setBusy(true);
    try { const { ok, data } = await apiRequest(`/notifications?before=${encodeURIComponent(next)}`); if (!ok) throw new Error(data?.message || 'Unable to load older notifications.'); if (mounted.current) { setItems(old => [...old, ...data.payload.items.filter(n => !old.some(o => o._id === n._id))]); setNext(data.payload.nextCursor); } }
    catch (e) { if (mounted.current) setError(e.message); } finally { if (mounted.current) setBusy(false); }
  };
  return <div className="coffee-notifications">
    <button ref={bell} type="button" className="notification-bell" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} aria-controls="notification-inbox" onClick={() => { setOpen(!open); refresh.current?.(); }}><FiBell /><span>Notifications</span>{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</button>
    {toast && !open && <div className="notification-toast" role="status"><strong>{toast.title}</strong><p>{toast.message}</p><button onClick={() => visit(toast)} disabled={busy}>View order</button><button aria-label="Dismiss notification alert" onClick={() => setToast(null)}><FiX /></button></div>}
    {open && <section className="notification-inbox" id="notification-inbox" aria-label="Your notifications" tabIndex={-1} ref={panel}>
      <header><div><h2>Your notifications</h2><p>{unread} unread · Updates every 10 seconds</p></div><button aria-label="Close notifications" onClick={() => setOpen(false)}><FiX /></button></header>
      <div className="notification-tools"><button onClick={() => refresh.current?.()} disabled={loading || busy}>Refresh</button><button disabled={!unread || !items.length || busy} onClick={() => act('/notifications/read-all', { through: items[0]._id })}><FiCheck /> Mark all read</button></div>
      {error && <p className="notification-error" role="alert">{error}</p>}
      <div className="notification-list">{loading ? <p role="status">Loading notifications…</p> : !items.length ? <p className="notification-empty">You're all caught up. Order updates will appear here.</p> : items.map(item => <article key={item._id} className={item.readAt ? '' : 'is-unread'}><button className="notification-item" disabled={busy} onClick={() => visit(item)}><strong>{!item.readAt && <i aria-label="Unread" />}{item.title}</strong><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT</time><span>View order →</span></button>{!item.readAt && <button className="notification-read" disabled={busy} onClick={() => act(`/notifications/${item._id}/read`)} aria-label={`Mark ${item.title} read`}><FiCheck /></button>}</article>)}{next && <button className="notification-more" disabled={busy} onClick={older}>Load older notifications</button>}</div>
    </section>}
  </div>;
}
