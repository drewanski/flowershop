import React from 'react';
import { stages, statusLabels, statusCopy, paymentLabel, dateLabel } from '../orderWorkflow';
import './OrderWorkflow.css';
export default function OrderProgress({order}) {
  const current = stages.indexOf(order.status);
  return <section className="order-tracking" aria-label={`Tracking ${order.orderNumber}`}>
    <p className="order-tracking-message">{order.paymentMethod==='online' && order.paymentStatus!=='paid' && order.status!=='cancelled' ? 'Payment must be confirmed before the shop can prepare this order.' : statusCopy[order.status] || 'Refresh to check your order.'}</p>
    {order.status==='cancelled' ? <p>{order.cancellationReason || 'This order was cancelled.'}</p> : <ol className="order-timeline">{stages.map((stage,index)=><li key={stage} className={index<=current?'is-complete':''} aria-current={stage===order.status?'step':undefined}><span className="order-timeline-dot">{index<current?'✓':index+1}</span><span>{statusLabels[stage]}{order[`${stage}At`] && <time dateTime={order[`${stage}At`]}>{dateLabel(order[`${stage}At`])}</time>}</span></li>)}</ol>}
    <p className="order-tracking-payment">{paymentLabel(order)}</p>
  </section>;
}
