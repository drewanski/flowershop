import { shoppingStorage } from '../shoppingSession';
import OrderProgress from '../components/OrderProgress';
import OrderLines from '../components/OrderLines';
import { statusLabels, paymentLabel } from '../orderWorkflow';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';
import './PaymentResult.css';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');
  const redirectStatus = searchParams.get('status');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancellationMessage, setCancellationMessage] = useState('');

  useEffect(() => {
    let active = true;
    let attempts = 0;
    let cancelAttempted = false;
    let cancellationBlocked = false;
    let timer;
    const loadOrder = async () => {
      const { ok, data } = await apiRequest('/orders/mine');
      if (!active) return;
      const orders = ok && Array.isArray(data?.payload) ? data.payload : [];
      let current = orders.find((item) => item.orderNumber === orderNumber) || null;
      if (current?.paymentMethod === 'online' && current.paymentStatus === 'pending' && current.status === 'pending' && attempts % 2 === 0) {
        try {
          const verified = await apiRequest(`/payments/orders/${current._id}/verify`, { method: 'POST' });
          if (verified.ok) {
            const refreshed = await apiRequest('/orders/mine');
            if (refreshed.ok && Array.isArray(refreshed.data?.payload)) current = refreshed.data.payload.find(item => item.orderNumber === orderNumber) || current;
          }
        } catch { /* Keep the reservation and retry; never trust redirect parameters. */ }
        if (!active) return;
      }
      if (current?.paymentMethod === 'online' && current.status === 'pending' && current.paymentStatus !== 'paid' && redirectStatus === 'cancelled' && !cancelAttempted) {
        cancelAttempted = true;
        const cancelled = await apiRequest(`/orders/mine/${current._id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Customer returned from online checkout without completing payment.' }) });
        if (!cancelled.ok) {
          cancellationBlocked = true;
          setCancellationMessage('Payment may still be processing, so we are keeping your order reserved while we confirm its status.');
        }
        const refreshed = await apiRequest('/orders/mine');
        const updatedOrders = refreshed.ok && Array.isArray(refreshed.data?.payload) ? refreshed.data.payload : orders;
        const updated = updatedOrders.find((item) => item.orderNumber === orderNumber) || current;
        setOrder(updated);
        setLoading(false);
        if (cancelled.ok) return;
      }
      setOrder(current);
      if (current?.paymentStatus === 'paid' && current?.paymentMethod === 'online') {
        setCancellationMessage('');
        try {
          const pendingBag = JSON.parse(shoppingStorage.getItem('coffeePendingPaymentBag') || 'null');
          if (pendingBag?.orderNumber === current.orderNumber) {
            if (pendingBag.items === shoppingStorage.getItem('cartItems')) {
              shoppingStorage.removeItem('cartItems');
              window.dispatchEvent(new Event('coffee-store-change'));
            }
            shoppingStorage.removeItem('coffeePendingPaymentBag');
          }
        } catch { shoppingStorage.removeItem('coffeePendingPaymentBag'); }
      }
      setLoading(false);
      if (current?.paymentMethod === 'online' && current?.paymentStatus === 'pending' && (redirectStatus !== 'cancelled' || cancellationBlocked) && attempts < 20) {
        attempts += 1;
        timer = window.setTimeout(loadOrder, 3000);
      }
    };

    if (orderNumber && localStorage.getItem('user_token')) {
      loadOrder().catch(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => { active = false; window.clearTimeout(timer); };
  }, [orderNumber, redirectStatus]);

  const paymentStatus = order?.paymentStatus || 'pending';
  const statusCopy = {
    paid: 'Payment confirmed',
    failed: 'Payment was not completed',
    pending: 'Payment is awaiting confirmation',
  };
  const heading = loading
    ? 'Checking order'
    : order?.status === 'delivered'
      ? 'Order completed'
      : order?.status === 'cancelled'
        ? 'Order cancelled'
        : order?.paymentMethod === 'cash'
          ? 'Order placed'
          : statusCopy[paymentStatus] || 'Order received';

  return (
    <main className="payment-result">
      <section className="payment-result-panel" aria-live="polite">
        <p className="payment-result-kicker">ORDER {orderNumber || 'STATUS'}</p>
        <h1>{heading}</h1>
        <p>
          {cancellationMessage || (order
            ? `Order status: ${statusLabels[order.status] || order.status}. ${order.grandTotal === 0 && order.paymentStatus === 'paid' ? 'Your voucher covered the full total; no payment is due.' : order.paymentMethod === 'cash' ? paymentLabel(order) : `Payment status: ${paymentStatus}.`}`
            : loading ? 'Checking your order and verifying payment with the provider…' : 'We could not load this order. Check your account order history for the latest status.')}
        </p>
        {order && <div className="payment-result-details"><div><span>Order number</span><strong>{order.orderNumber}</strong></div><div><span>Payment</span><strong>{order.paymentMethod === 'cash' ? 'Cash on delivery' : String(paymentStatus).replace(/_/g, ' ')}</strong></div>{order.vouchersApplied?.length > 0 && <div><span>{order.vouchersApplied.map((applied) => applied.voucher?.voucher?.code).filter(Boolean).join(', ') || 'Voucher'} savings</span><strong>− ₱ {order.vouchersApplied.reduce((sum, applied) => sum + (Number(applied.discountAmount) || 0), 0).toLocaleString()}</strong></div>}<div><span>Order total</span><strong>₱ {(Number(order.grandTotal) || 0).toLocaleString()}</strong></div></div>}
        {order && <><OrderLines order={order}/><OrderProgress order={order}/></>}
        <div className="payment-result-actions">
          {order?.paymentMethod === 'online' && order.paymentStatus === 'pending' && order.status === 'pending' && order.paymentCheckoutUrl && <a href={order.paymentCheckoutUrl}>Continue secure payment</a>}
          <Link to="/userinfo">View order history</Link>
          <Link to="/shop">Return to shop</Link>
        </div>
      </section>
    </main>
  );
}
