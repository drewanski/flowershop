require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const EmployeeLog = require('../src/models/EmployeeLog');
const { encryptPassword } = require('../src/utils/AuthUtils');
const Paymongo = require('../src/services/PaymongoService');
const base = 'http://localhost:5000/api';
const tag = crypto.randomBytes(5).toString('hex');
const users = [], products = [], sessions = [];
async function request(path, token, body, method = body ? 'POST' : 'GET', expected = true) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.equal(response.ok, expected, `${path}: ${data.message}`);
  return data.payload;
}
async function event(order, amount, version = 'v1', signed = true) {
  const resource = { type: 'checkout_session.payment.paid', data: { id: order.paymentCheckoutSessionId, attributes: { payments: [{ id: 'pay_smoke_' + tag, attributes: { status: 'paid', amount, net_amount: amount - 200, currency: 'PHP' } }] } } };
  const body = JSON.stringify({ data: version === 'v1' ? { type: 'event', attributes: resource } : resource });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
  return fetch(base + '/payments/paymongo/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(signed ? { 'Paymongo-Signature': `t=${timestamp},te=${signature}` } : {}) }, body });
}
async function run() {
  assert(process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_test_'), 'Only test-mode credentials are allowed');
  assert(process.env.PAYMONGO_WEBHOOK_SECRET, 'Webhook secret required');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');
  try {
    const tokens = {};
    for (const role of ['customer', 'crew']) {
      const password = crypto.randomBytes(16).toString('hex');
      const user = await User.create({ firstName: 'Payment Smoke', lastName: role, username: `pay${role}${tag}`, email: `payment-${role}-${tag}@example.com`, contactNumber: `09${crypto.randomInt(100000000, 999999999)}`, password: await encryptPassword(password), role });
      users.push(user);
      tokens[role] = (await request('/auth/login', null, { email: user.email, password })).token;
    }
    const product = await Product.create({ sku: 'PAY-SMOKE-' + tag, name: 'Temporary payment test coffee', description: 'Disposable test record', category: 'Test', price: 100, stock: 5, image: '/images/latte.svg', status: 'available', createdBy: users[1]._id, updatedBy: users[1]._id });
    products.push(product);
    const payload = { paymentMethod: 'online', notes: 'AUTOMATED PAYMENT TEST ONLY', products: [{ product: String(product._id), quantity: 1 }], deliveryAddress: { latitude: 14.6, longitude: 121, street: 'Test Street', barangay: 'Test', city: 'Manila', province: 'Metro Manila' } };
    const order = await request('/orders', tokens.customer, payload);
    sessions.push(order.paymentCheckoutSessionId);
    assert(order.paymentCheckoutUrl?.startsWith('https://checkout.paymongo.com/'));
    await request(`/orders/${order._id}/status`, tokens.crew, { status: 'confirmed' }, 'PATCH', false);
    assert.equal((await event(order, 10000, 'v1', false)).status, 401);
    assert.equal((await event(order, 9900)).status, 400);
    assert.equal((await event(order, 10000)).status, 200);
    const paid = await Order.findById(order._id);
    assert.equal(paid.paymentStatus, 'paid');
    assert.equal(paid.paymentAmount, 100);
    assert.equal((await event(order, 10000, 'v2')).status, 200);
    assert.equal((await Order.findById(order._id)).paidAt.getTime(), paid.paidAt.getTime());
    await request(`/orders/${order._id}/payment`, tokens.crew, { paymentStatus: 'paid' }, 'PATCH', false);
    await request(`/orders/${order._id}/status`, tokens.crew, { status: 'confirmed' }, 'PATCH');
    const history = await request('/orders/mine', tokens.customer);
    assert.equal(history.find(item => item._id === order._id).paymentStatus, 'paid');
    const abandoned = await request('/orders', tokens.customer, payload);
    sessions.push(abandoned.paymentCheckoutSessionId);
    await request(`/orders/mine/${abandoned._id}/cancel`, tokens.customer, { reason: 'Payment smoke cancellation' });
    assert.equal((await Order.findById(abandoned._id)).status, 'cancelled');
    assert.equal((await Product.findById(product._id)).stock, 4);
    console.log('PASS: real hosted test checkout, unpaid fulfillment guard, unsigned/mismatched webhook rejection, simulated signed v1/v2 confirmation, gross amount validation, duplicate handling, staff payment guard, paid fulfillment, customer history, real provider session expiry and cancellation stock restoration.');
    console.log('Payment notifications were simulated locally; no card or wallet payment was submitted.');
  } finally {
    for (const id of sessions) await Paymongo.expireCheckoutSession(id);
    await Order.deleteMany({ user: { $in: users.map(user => user._id) } });
    await EmployeeLog.deleteMany({ user: { $in: users.map(user => user._id) } });
    await Product.deleteMany({ _id: { $in: products.map(product => product._id) } });
    await User.deleteMany({ _id: { $in: users.map(user => user._id) } });
    await mongoose.disconnect();
    console.log('Temporary payment test records removed.');
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
