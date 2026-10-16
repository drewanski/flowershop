require('dotenv').config();

const crypto = require('crypto');
const mongoose = require('mongoose');

const ContactMessage = require('../src/models/ContactMessage');
const EmployeeLog = require('../src/models/EmployeeLog');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const User = require('../src/models/User');
const { encryptPassword } = require('../src/utils/AuthUtils');

const apiBaseUrl = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/$/, '');
const tag = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
const adminEmail = `smoke-admin-${tag}@example.com`;
const customerEmail = `smoke-customer-${tag}@example.com`;
const contactEmail = `smoke-contact-${tag}@example.com`;
const productSku = `SMOKE-${tag}`;
const addonSku = `SMOKE-ADDON-${tag}`;

const uniquePhone = (prefix) => `${prefix}${Math.floor(1000000 + Math.random() * 8999999)}`;

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${data.message || 'Unknown error'}`);
  }

  return data;
};

const run = async () => {
  let admin;
  let deliveryUser;
  let customerId;
  let orderNumber;

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');

    admin = await User.create({
      firstName: 'Smoke',
      lastName: 'Admin',
      contactNumber: uniquePhone('0917'),
      username: `smokeadmin${tag}`,
      email: adminEmail,
      password: await encryptPassword('SmokeAdminPass123'),
      role: 'admin',
    });
    deliveryUser = await User.create({
      firstName: 'Smoke',
      lastName: 'Rider',
      contactNumber: uniquePhone('0919'),
      username: `smokerider${tag}`,
      email: `smoke-rider-${tag}@example.com`,
      password: await encryptPassword('SmokeRiderPass123'),
      role: 'delivery',
    });

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: 'SmokeAdminPass123' }),
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.payload.token}` };
    const addonResult = await request('/products', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        sku: addonSku,
        name: 'Integration Smoke Add-on',
        description: 'Temporary add-on validation fixture.',
        price: 2,
        image: 'https://example.com/smoke-addon.png',
        category: 'Integration Smoke Test',
        stock: 6,
        isAddon: true,
      }),
    });
    const productResult = await request('/products', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        sku: productSku,
        name: 'Integration Smoke Product',
        description: 'Temporary integration test fixture.',
        price: 12.5,
        image: 'https://example.com/smoke-product.png',
        category: 'Integration Smoke Test',
        stock: 3,
        type: 'Smoke Test',
        allowedAddons: [{ addon: addonResult.payload._id, minQuantity: 1, maxQuantity: 2 }],
      }),
    });

    const registration = await request('/auth/register-customer', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Smoke',
        lastName: 'Customer',
        contactNumber: uniquePhone('0918'),
        username: `smokecustomer${tag}`,
        email: customerEmail,
        password: 'SmokeCustomerPass123',
      }),
    });
    customerId = registration.payload._id;

    const customerLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: customerEmail, password: 'SmokeCustomerPass123' }),
    });
    const customerHeaders = { Authorization: `Bearer ${customerLogin.payload.token}` };
    const profile = await request('/auth/profile', {
      method: 'PATCH',
      headers: customerHeaders,
      body: JSON.stringify({ firstName: 'Updated', lastName: 'Smoke Customer' }),
    });

    const order = await request('/orders', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        paymentMethod: 'cash',
        deliveryAddress: {
          latitude: 14.5995,
          longitude: 120.9842,
          apartmentBuildingLotNumber: 'Unit 1',
          street: 'Test Street',
          barangay: 'Test Barangay',
          city: 'Manila',
          province: 'Metro Manila',
          zipCode: '1000',
        },
        products: [{ product: productResult.payload._id, quantity: 1, addons: [{ addon: addonResult.payload._id, quantity: 1 }] }],
      }),
    });
    orderNumber = order.payload.orderNumber;

    for (const status of ['confirmed', 'queued', 'ready']) {
      await request(`/orders/${order.payload._id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status }),
      });
    }
    const riderLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: deliveryUser.email, password: 'SmokeRiderPass123' }),
    });
    const riderHeaders = { Authorization: `Bearer ${riderLogin.payload.token}` };
    const availableDeliveries = await request('/orders/delivery/available', { headers: riderHeaders });
    if (!availableDeliveries.payload.some((item) => item.orderNumber === orderNumber)) {
      throw new Error('Ready order was not available to delivery staff.');
    }
    for (const action of ['claim', 'ship', 'deliver']) {
      await request(`/orders/delivery/${order.payload._id}/${action}`, {
        method: 'POST',
        headers: riderHeaders,
      });
    }
    await request(`/orders/${order.payload._id}/payment`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ paymentStatus: 'paid', paymentAmount: order.payload.grandTotal, paymentChange: 0 }),
    });

    const history = await request('/orders/mine', { headers: customerHeaders });
    const completedOrder = history.payload.find((item) => item.orderNumber === orderNumber);
    if (completedOrder?.status !== 'delivered' || completedOrder?.paymentStatus !== 'paid') {
      throw new Error('Order did not reach delivered and paid completion.');
    }
    const adminCustomers = await request('/admin/customers', { headers: adminHeaders });
    const employeeLogs = await request('/admin/employee-logs', { headers: adminHeaders });
    const contact = await request('/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'Smoke Test', email: contactEmail, message: 'Temporary validation message.' }),
    });
    const paymentMethods = await request('/payments/methods');
    if (!PaymongoIsConfigured() && paymentMethods.payload.includes('online')) {
      throw new Error('Online payment was advertised without PayMongo credentials.');
    }
    if (!PaymongoIsConfigured()) {
      const disabledCheckout = await fetch(`${apiBaseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...customerHeaders },
        body: JSON.stringify({
          paymentMethod: 'online',
          products: [{ product: productResult.payload._id, quantity: 1, addons: [{ addon: addonResult.payload._id, quantity: 1 }] }],
        }),
      });
      const disabledBody = await disabledCheckout.json();
      if (disabledCheckout.ok || !disabledBody.message?.includes('not configured')) {
        throw new Error('Online checkout was not safely disabled without provider credentials.');
      }
    }

    console.log(`Product creation: ${productResult.message}`);
    console.log(`Required add-on creation: ${addonResult.message}`);
    console.log(`Customer registration: ${registration.message}`);
    console.log(`Profile update: ${profile.payload.firstName} ${profile.payload.lastName}`);
    console.log(`Checkout: ${order.message}`);
    console.log(`Order appears in history: ${history.payload.some((item) => item.orderNumber === orderNumber)}`);
    console.log(`End-to-end order completed and paid: ${completedOrder.status}/${completedOrder.paymentStatus}`);
    console.log(`Admin customer results: ${adminCustomers.payload.length}`);
    console.log(`Employee log results: ${employeeLogs.payload.length}`);
    console.log(`Contact submission: ${contact.message}`);
    console.log(`Payment methods: ${paymentMethods.payload.join(', ')}`);
    if (!PaymongoIsConfigured()) console.log('Unconfigured online checkout: safely rejected.');
  } finally {
    if (mongoose.connection.readyState === 1) {
      if (customerId) await Order.deleteMany({ user: customerId });
      if (orderNumber) await Order.deleteOne({ orderNumber });
      await Product.deleteOne({ sku: productSku });
      await Product.deleteOne({ sku: addonSku });
      await EmployeeLog.deleteMany({ email: { $in: [adminEmail, `smoke-rider-${tag}@example.com`] } });
      await ContactMessage.deleteOne({ email: contactEmail });
      if (admin) await User.deleteOne({ _id: admin._id });
      if (deliveryUser) await User.deleteOne({ _id: deliveryUser._id });
      await User.deleteOne({ email: customerEmail });
      await mongoose.disconnect();
      console.log('Temporary integration records removed.');
    }
  }
};

const PaymongoIsConfigured = () => Boolean(process.env.PAYMONGO_SECRET_KEY && process.env.PAYMONGO_WEBHOOK_SECRET);

run().catch((error) => {
  console.error(`Integration smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
