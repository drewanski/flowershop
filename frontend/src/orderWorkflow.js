export const stages = ['pending', 'confirmed', 'queued', 'ready', 'claimed', 'shipped', 'delivered'];
export const statusLabels = { pending: 'Order received', confirmed: 'Accepted', queued: 'Preparing', ready: 'Ready for rider', claimed: 'Rider assigned', shipped: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
export const statusCopy = { pending: 'The shop is reviewing your order.', confirmed: 'Your coffee order has been accepted.', queued: 'The team is preparing your coffee.', ready: 'Your order is ready and waiting for a rider.', claimed: 'A rider has claimed your delivery.', shipped: 'Your coffee is on its way. Keep your phone nearby.', delivered: 'Your order has arrived. Enjoy your coffee break.', cancelled: 'This order will not be prepared or delivered.' };
export const nextAction = { pending: ['confirmed', 'Accept order'], confirmed: ['queued', 'Start preparing'], queued: ['ready', 'Mark ready for rider'] };
export const canCancel = order => ['pending','confirmed','queued','ready'].includes(order.status) && !(order.paymentMethod === 'online' && order.paymentStatus === 'paid' && order.grandTotal > 0);
export const paymentLabel = order => order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'failed' ? 'Payment failed' : order.paymentMethod === 'cash' ? 'Cash due on delivery' : 'Awaiting online payment';
export const addressLabel = address => address ? [address.apartmentBuildingLotNumber,address.street,address.barangay,address.city,address.province,address.zipCode].filter(Boolean).join(', ') : 'No delivery address';
export const isActive = order => !['delivered','cancelled'].includes(order.status);
export const dateLabel = value => value ? new Date(value).toLocaleString('en-PH', {timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';
export const todayInManila = value => new Date(value).toLocaleDateString('en-CA', {timeZone:'Asia/Manila'});
export function summarizeOrders(orders, now = new Date()) {
  const today = todayInManila(now);
  return { today: orders.filter(o=>todayInManila(o.createdAt)===today).length, active: orders.filter(isActive).length, collected: orders.filter(o=>o.paymentStatus==='paid' && o.status!=='cancelled' && o.paidAt && todayInManila(o.paidAt)===today).reduce((sum,o)=>sum+Number(o.grandTotal || 0),0) };
}
