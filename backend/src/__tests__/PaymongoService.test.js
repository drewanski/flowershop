jest.mock('../services/NotificationService', () => ({ notifyOrder: jest.fn().mockResolvedValue(undefined) }));
const crypto = require('crypto');
const PaymongoService = require('../services/PaymongoService');

describe('PayMongo payment integration', () => {
  const originalSecret = process.env.PAYMONGO_SECRET_KEY;
  const originalWebhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const originalFrontendUrl = process.env.FRONTEND_BASE_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PAYMONGO_SECRET_KEY;
    else process.env.PAYMONGO_SECRET_KEY = originalSecret;
    if (originalWebhookSecret === undefined) delete process.env.PAYMONGO_WEBHOOK_SECRET;
    else process.env.PAYMONGO_WEBHOOK_SECRET = originalWebhookSecret;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_BASE_URL;
    else process.env.FRONTEND_BASE_URL = originalFrontendUrl;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('does not advertise PayMongo until both secrets are set', () => {
    delete process.env.PAYMONGO_SECRET_KEY;
    delete process.env.PAYMONGO_WEBHOOK_SECRET;
    expect(PaymongoService.isConfigured()).toBe(false);
    process.env.PAYMONGO_SECRET_KEY = 'sk_test_example';
    expect(PaymongoService.isConfigured()).toBe(false);
  });

  test('validates webhook signatures and rejects stale/tampered payloads', () => {
    const body = Buffer.from('{"data":{"attributes":{"type":"checkout_session.payment.paid"}}}');
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = 'webhook-secret';
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body.toString()}`).digest('hex');

    expect(PaymongoService.verifyWebhookSignature(body, `t=${timestamp},te=${signature}`, secret)).toBe(true);
    expect(PaymongoService.verifyWebhookSignature(body, `t=${timestamp - 600},te=${signature}`, secret)).toBe(false);
    expect(PaymongoService.verifyWebhookSignature(Buffer.from('tampered'), `t=${timestamp},te=${signature}`, secret)).toBe(false);
  });

  test('creates a hosted PHP checkout session using server-owned order values', async () => {
    process.env.PAYMONGO_SECRET_KEY = 'sk_test_example';
    process.env.FRONTEND_BASE_URL = 'http://localhost:3000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'cs_test_123', attributes: { checkout_url: 'https://checkout.paymongo.test/session' } } }),
    });

    const session = await PaymongoService.createCheckoutSession({ orderId: 'order-id', orderNumber: 'ORD-1', amount: 125.5 });
    const request = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(session.id).toBe('cs_test_123');
    expect(session.url).toContain('checkout.paymongo.test');
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.paymongo.com/v2/checkout_sessions');
    expect(request.data.attributes.line_items[0]).toMatchObject({ currency: 'PHP', amount: 12550 });
    expect(request.data.attributes.payment_method_types).toEqual(['card', 'gcash', 'qrph']);
    expect(request.data.attributes.reference_number).toBe('ORD-1');
    expect(request.data.attributes.metadata.order_id).toBe('order-id');
  });

  test.each(['v2', 'v1'])('records a signed %s paid webhook using gross amount rather than net after fees', async (version) => {
    const Order = require('../models/Order');
    const previousFindOne = Order.findOne;
    const previousUpdate = Order.findOneAndUpdate;
    process.env.PAYMONGO_WEBHOOK_SECRET = 'webhook-secret';
    const order = {
      paymentStatus: 'pending', status: 'pending', grandTotal: 125.5,
      paymentCheckoutSessionId: 'cs_v2_123', products: [], vouchersApplied: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    Order.findOne = jest.fn().mockResolvedValue(order);
    Order.findOneAndUpdate = jest.fn().mockImplementation(async (filter, update) => Object.assign(order, update.$set));
    const event = { type: 'checkout_session.payment.paid', data: { id: 'cs_v2_123', attributes: { payments: [{id:'pay_failed',attributes:{status:'failed'}}, { id: 'pay_123', attributes: { status: 'paid', amount: 12550, net_amount: 12000, currency: 'PHP' } }] } } };
    const body = Buffer.from(JSON.stringify({ data: version === 'v1' ? {type:'event',attributes:event} : event }));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET).update(`${timestamp}.${body.toString('utf8')}`).digest('hex');

    try {
      const result = await PaymongoService.processWebhook(body, `t=${timestamp},te=${signature}`);
      expect(result.status).toBe(200);
      expect(order.paymentStatus).toBe('paid');
      expect(order.paymentReference).toBe('pay_123');
      expect(Order.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({paymentStatus:'pending'}),expect.any(Object),expect.any(Object));
    } finally {
      Order.findOne = previousFindOne;
      Order.findOneAndUpdate = previousUpdate;
    }
  });

  test('expires abandoned v2 sessions before an online order is cancelled', async () => {
    process.env.PAYMONGO_SECRET_KEY = 'sk_test_example';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await expect(PaymongoService.expireCheckoutSession('cs_test_123')).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://api.paymongo.com/v1/checkout_sessions/cs_test_123/expire', expect.objectContaining({ method: 'POST' }));
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
    await expect(PaymongoService.expireCheckoutSession('cs_processing')).resolves.toBe(false);
  });
});

