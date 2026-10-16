const crypto = require('crypto');
const Order = require('../models/Order');
const VoucherInstance = require('../models/VoucherInstance');
const VoucherTemplate = require('../models/VoucherTemplate');
const Product = require('../models/Product');
const LogUtils = require('../utils/LogUtils');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../constants/OrderConstants');
const { PRODUCT_STATUS } = require('../constants/ProductConstants');
const { VOUCHER_STATUS } = require('../constants/VoucherConstants');

const isConfigured = () => Boolean(
  process.env.PAYMONGO_SECRET_KEY && process.env.PAYMONGO_WEBHOOK_SECRET
);

const createCheckoutSession = async ({ orderId, orderNumber, amount }) => {
  if (!process.env.PAYMONGO_SECRET_KEY) {
    throw new Error('Online payment is not configured.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Online payment requires an amount greater than zero.');
  }

  const frontendBaseUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64');
  const response = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{
            currency: 'PHP',
            amount: Math.round(amount * 100),
            name: `Sampaguita order ${orderNumber}`,
            quantity: 1,
          }],
          payment_method_types: ['card', 'gcash', 'qrph'],
          reference_number: orderNumber,
          metadata: { order_id: String(orderId), order_number: orderNumber },
          success_url: `${frontendBaseUrl}/payment/result?order=${encodeURIComponent(orderNumber)}&status=success`,
          cancel_url: `${frontendBaseUrl}/payment/result?order=${encodeURIComponent(orderNumber)}&status=cancelled`,
        },
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    const detail = result?.errors?.[0]?.detail;
    throw new Error(detail || 'PayMongo could not create a checkout session.');
  }

  const session = result?.data;
  if (!session?.id || !session?.attributes?.checkout_url) {
    throw new Error('PayMongo returned an incomplete checkout session.');
  }

  return { id: session.id, url: session.attributes.checkout_url };
};

const expireCheckoutSession = async (sessionId) => {
  if (!process.env.PAYMONGO_SECRET_KEY || !sessionId) return false;
  const auth = Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64');
  try {
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}/expire`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    });
    // A 400 can mean paid or still processing. Never release inventory in that case.
    if (response.ok) return true;
    if (response.status === 400) {
      const current = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Basic ${auth}` } });
      if (current.ok) { const body = await current.json(); return body?.data?.attributes?.status === 'expired'; }
    }
    return false;
  } catch (error) {
    return false;
  }
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

// The provider response is fetched with the server secret, never supplied by the browser.
const verifyCustomerPayment = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) return { status: 404, message: 'Order not found.' };
  if (order.paymentMethod !== 'online' || order.status === ORDER_STATUS.CANCELLED || order.paymentStatus === PAYMENT_STATUS.PAID) return { status: 200, message: 'Order already handled.' };
  if (!order.paymentCheckoutSessionId || !process.env.PAYMONGO_SECRET_KEY) return { status: 400, message: 'No online checkout to verify.' };
  const auth = Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64');
  const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(order.paymentCheckoutSessionId)}`, { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) return { status: 502, message: 'Unable to verify payment with PayMongo. Please retry.' };
  const session = (await response.json()).data;
  const attributes = session?.attributes || {};
  if (session?.id !== order.paymentCheckoutSessionId || attributes.livemode !== process.env.PAYMONGO_SECRET_KEY.startsWith('sk_live_') || attributes.reference_number !== order.orderNumber) return { status: 400, message: 'Payment session does not match this order.' };
  const payment = attributes.payments?.find(item => item.attributes?.status === 'paid');
  if (!payment) return { status: 200, message: 'Payment is still awaiting confirmation.' };
  return recordPaidSession(order, session);
};

const recordPaidSession = async (order, session) => {
  const payment = session.attributes?.payments?.find(item => item.attributes?.status === 'paid');
  if (!payment?.id || payment.attributes.currency?.toUpperCase() !== 'PHP' || Number(payment.attributes.amount) !== Math.round(order.grandTotal * 100)) return { status: 400, message: 'Payment amount or currency does not match the order.' };
  const recorded = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: order.paymentStatus, status: { $ne: ORDER_STATUS.CANCELLED } }, { $set: { paymentStatus: PAYMENT_STATUS.PAID, paymentAmount: order.grandTotal, paymentReference: payment.id, paidAt: new Date() } }, { returnDocument: 'after' });
  if (recorded) await require('./NotificationService').notifyOrder(recorded, 'payment:paid');
  return { status: 200, message: recorded ? 'Payment event recorded.' : 'Payment already handled.' };
};

const verifyWebhookSignature = (rawBody, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000)) => {
  if (!Buffer.isBuffer(rawBody) || !signatureHeader || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    })
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;

  const digest = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody.toString('utf8')}`).digest('hex');
  const signature = process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_live_') ? parts.li : parts.te;
  return Boolean(signature && safeEqual(signature, digest));
};

const processWebhook = async (rawBody, signatureHeader) => {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) return { status: 503, message: 'Payment webhook is not configured.' };
  if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    return { status: 401, message: 'Invalid payment webhook signature.' };
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    return { status: 400, message: 'Invalid webhook payload.' };
  }

  // v2 webhook envelope: data.type + data.data; v1 uses data.attributes.type/data.
  const eventType = event?.data?.attributes?.type || event?.data?.type;
  const session = event?.data?.data || event?.data?.attributes?.data;
  const sessionId = session?.id;
  if (!sessionId || !['checkout_session.payment.paid', 'checkout_session.payment.failed', 'checkout_session.expired'].includes(eventType)) {
    return { status: 200, message: 'Event ignored.' };
  }

  const order = await Order.findOne({ paymentCheckoutSessionId: sessionId });
  if (!order) return { status: 200, message: 'Unknown checkout session ignored.' };
  if (order.paymentStatus === PAYMENT_STATUS.PAID) return { status: 200, message: 'Payment already recorded.' };
  if (order.status === ORDER_STATUS.CANCELLED) return { status: 200, message: 'Cancelled order payment event ignored.' };

  if (eventType === 'checkout_session.payment.failed'
    && !(await expireCheckoutSession(sessionId))) {
    return { status: 200, message: 'Checkout remains active; order reservation retained.' };
  }

  const attributes = session.attributes || {};
  const paidPayment = attributes.payments?.find((payment) => payment.attributes?.status === 'paid');
  const paymentAttributes = paidPayment?.attributes || {};
  const webhookAmount = paymentAttributes.amount;
  if (eventType === 'checkout_session.payment.paid' && (!paidPayment || !Number.isFinite(Number(webhookAmount)) || paymentAttributes.currency?.toUpperCase() !== 'PHP')) return { status: 400, message: 'Paid payment details are incomplete.' };
  if (eventType === 'checkout_session.payment.paid' && webhookAmount !== undefined
    && Number(webhookAmount) !== Math.round(order.grandTotal * 100)) {
    LogUtils.logWarning(`PayMongo amount mismatch for order ${order.orderNumber}.`);
    return { status: 400, message: 'Payment amount does not match the order.' };
  }

  if (eventType === 'checkout_session.payment.paid') {
    if (paymentAttributes.currency && paymentAttributes.currency.toUpperCase() !== 'PHP') {
      LogUtils.logWarning(`PayMongo currency mismatch for order ${order.orderNumber}.`);
      return { status: 400, message: 'Payment currency does not match the order.' };
    }
    return recordPaidSession(order, session);
  } else {
    const cancelled = await Order.findOneAndUpdate({ _id: order._id, status: order.status, paymentStatus: order.paymentStatus }, { $set: { paymentStatus: PAYMENT_STATUS.FAILED, status: ORDER_STATUS.CANCELLED, cancelledAt: new Date(), cancellationReason: 'Online payment session closed.' } }, { returnDocument: 'after' });
    if (!cancelled) return { status: 200, message: 'Payment already handled.' };
    order.paymentStatus = PAYMENT_STATUS.FAILED;
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = 'Online payment failed.';

    for (const item of order.products) {
      const mainId = String(item.product);
      const mainProduct = await Product.findById(mainId);
      if (mainProduct) {
        await Product.updateOne(
          { _id: mainId },
          {
            $inc: { stock: item.quantity },
            ...(mainProduct.status === PRODUCT_STATUS.OUT_OF_STOCK ? { $set: { status: PRODUCT_STATUS.AVAILABLE } } : {}),
          }
        );
      }
      for (const addon of item.addons || []) {
        const addonId = String(addon.addon);
        const addonProduct = await Product.findById(addonId);
        if (addonProduct) {
          await Product.updateOne(
            { _id: addonId },
            {
              $inc: { stock: addon.quantity * item.quantity },
              ...(addonProduct.status === PRODUCT_STATUS.OUT_OF_STOCK ? { $set: { status: PRODUCT_STATUS.AVAILABLE } } : {}),
            }
          );
        }
      }
    }

    for (const applied of order.vouchersApplied || []) {
      const instance = await VoucherInstance.findOneAndUpdate(
        { _id: applied.voucher, status: VOUCHER_STATUS.USED, usedInOrder: order._id },
        { $set: { status: VOUCHER_STATUS.ACTIVE }, $unset: { usedAt: 1, usedInOrder: 1 } },
        { returnDocument: 'after' }
      );
      if (instance) {
        await VoucherTemplate.updateOne(
          { _id: instance.template, usageCountPublic: { $gt: 0 } },
          { $inc: { usageCountPublic: -1 } }
        );
      }
    }
  }

  await require('./NotificationService').notifyOrder(order, 'status:cancelled');
  return { status: 200, message: 'Payment event recorded.' };
};

module.exports = { isConfigured, createCheckoutSession, expireCheckoutSession, verifyWebhookSignature, processWebhook, verifyCustomerPayment };
