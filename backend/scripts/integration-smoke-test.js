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

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: 'SmokeAdminPass123' }),
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.payload.token}` };
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
        products: [{ product: productResult.payload._id, quantity: 1, addons: [] }],
      }),
    });
    orderNumber = order.payload.orderNumber;

    const history = await request('/orders/mine', { headers: customerHeaders });
    const adminCustomers = await request('/admin/customers', { headers: adminHeaders });
    const employeeLogs = await request('/admin/employee-logs', { headers: adminHeaders });
    const contact = await request('/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'Smoke Test', email: contactEmail, message: 'Temporary validation message.' }),
    });

    console.log(`Product creation: ${productResult.message}`);
    console.log(`Customer registration: ${registration.message}`);
    console.log(`Profile update: ${profile.payload.firstName} ${profile.payload.lastName}`);
    console.log(`Checkout: ${order.message}`);
    console.log(`Order appears in history: ${history.payload.some((item) => item.orderNumber === orderNumber)}`);
    console.log(`Admin customer results: ${adminCustomers.payload.length}`);
    console.log(`Employee log results: ${employeeLogs.payload.length}`);
    console.log(`Contact submission: ${contact.message}`);
  } finally {
    if (mongoose.connection.readyState === 1) {
      if (customerId) await Order.deleteMany({ user: customerId });
      if (orderNumber) await Order.deleteOne({ orderNumber });
      await Product.deleteOne({ sku: productSku });
      await EmployeeLog.deleteMany({ email: adminEmail });
      await ContactMessage.deleteOne({ email: contactEmail });
      if (admin) await User.deleteOne({ _id: admin._id });
      await User.deleteOne({ email: customerEmail });
      await mongoose.disconnect();
      console.log('Temporary integration records removed.');
    }
  }
};

run().catch((error) => {
  console.error(`Integration smoke test failed: ${error.message}`);
  process.exitCode = 1;
});