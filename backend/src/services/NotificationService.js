const Notification = require('../models/Notification');
const User = require('../models/User');
const LogUtils = require('../utils/LogUtils');
const labels = { confirmed: 'accepted', queued: 'being prepared', ready: 'ready for pickup by a rider', claimed: 'assigned to a rider', shipped: 'out for delivery', delivered: 'delivered', cancelled: 'cancelled' };
const id = value => value?._id || value;

// Notification failures must never undo an already committed order/payment.
// Unique event keys make retries (including duplicate payment webhooks) safe.
async function notifyOrder(order, event) {
  if (!order?._id || !order.user) return;
  try {
    const number = order.orderNumber || String(order._id);
    const deliveries = [];
    const customer = (title, message) => deliveries.push({ recipient: id(order.user), role: 'customer', title, message });
    const group = async (roles, title, message) => {
      const users = await User.find({ role: { $in: roles }, isDisabled: { $ne: true } }).select('_id role').lean();
      deliveries.push(...users.map(user => ({ recipient: user._id, role: user.role, title, message, ...(user.role === 'delivery' ? { deliveryView: 'available' } : {}) })));
    };
    const ops = (title, message) => group(['admin', 'manager', 'crew'], title, message);
    const rider = (title, message) => {
      if (order.deliveryRider) deliveries.push({ recipient: id(order.deliveryRider), role: 'delivery', title, message, deliveryView: 'mine' });
    };
    if (event === 'created') {
      const awaiting = order.paymentMethod === 'online' && order.paymentStatus !== 'paid';
      customer('Order received', `${number} was received.${awaiting ? ' Complete secure payment before preparation can begin.' : ' We will notify you when the shop accepts it.'}`);
      await ops('New coffee order', `${number} has arrived.${awaiting ? ' Awaiting online payment; do not prepare yet.' : ' Review the order in the queue.'}`);
    } else if (event === 'payment:paid') {
      customer('Payment confirmed', `Payment for ${number} has been confirmed.`);
      await ops('Payment confirmed', `${number} is paid.${order.status === 'pending' ? ' It can now be accepted for preparation.' : ''}`);
    } else if (event === 'assigned') {
      rider('Delivery assigned to you', `${number} has been assigned to you. Check its preparation status before pickup.`);
    } else if (event.startsWith('status:')) {
      const status = event.slice(7);
      if (!labels[status]) return;
      customer(`Order ${labels[status]}`, `${number} is ${labels[status]}.${status === 'cancelled' && order.cancellationReason ? ` Reason: ${order.cancellationReason}` : ''}`);
      if (status === 'ready' && order.deliveryAddress) {
        if (order.deliveryRider) rider('Order ready for pickup', `${number} is ready. Open your deliveries to collect it.`);
        else await group(['delivery'], 'Delivery ready to claim', `${number} is ready for pickup. Open available deliveries to claim it. Availability may change if another rider claims it first.`);
      }
      if (status === 'claimed') rider('Pickup confirmed', `You claimed ${number}. Collect the order and start delivery when ready.`);
      if (['claimed', 'shipped', 'delivered', 'cancelled'].includes(status)) await ops(`Order ${labels[status]}`, `${number} is ${labels[status]}.`);
      if (status === 'cancelled') rider('Delivery cancelled', `${number} was cancelled. Do not collect or deliver it.`);
    } else return;
    const eventKey = `${order._id}:${event}${event === 'assigned' ? `:${id(order.deliveryRider)}` : ''}`;
    if (deliveries.length) await Notification.bulkWrite(deliveries.map(delivery => ({ updateOne: {
      filter: { recipient: delivery.recipient, eventKey },
      update: { $setOnInsert: { ...delivery, eventKey, kind: event, order: order._id, orderNumber: number, readAt: null } },
      upsert: true,
    } })), { ordered: false });
  } catch (error) {
    LogUtils.logError(`Unable to save order notifications: ${error.message}`);
  }
}
module.exports = { notifyOrder };
