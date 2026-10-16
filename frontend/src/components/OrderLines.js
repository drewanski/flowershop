import React from 'react';
import { optionText } from '../storeState';
export default function OrderLines({ order }) {
  return <div className="coffee-order-lines"><ul>{(order.products || []).map((item,index)=><li key={index}><strong>{item.quantity} x {item.productName || item.product?.name || 'Coffee'}</strong>{!!item.options?.length && <small>{optionText(item.options)}</small>}{(item.addons || []).map((addon,index)=><small key={index}>+ {addon.addon?.name || 'Extra'} x {addon.quantity} per item</small>)}</li>)}</ul>{order.notes && <p><b>Barista note:</b> {order.notes}</p>}</div>;
}
