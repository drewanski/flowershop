jest.mock('../services/NotificationService', () => ({ notifyOrder: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../models/Order', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
const Order = require('../models/Order');
const { verifyCustomerPayment } = require('../services/PaymongoService');
const originalFetch = global.fetch;
const originalKey = process.env.PAYMONGO_SECRET_KEY;
const order = { _id:'order', user:'customer', orderNumber:'ORD-TEST', status:'pending', paymentMethod:'online', paymentStatus:'pending', paymentCheckoutSessionId:'cs_test', grandTotal:100 };
const session = { id:'cs_test', attributes:{livemode:false, reference_number:'ORD-TEST', payments:[{id:'pay_test',attributes:{status:'paid',amount:10000,net_amount:9500,currency:'PHP'}}]} };
beforeEach(() => { jest.clearAllMocks(); process.env.PAYMONGO_SECRET_KEY='sk_test_example'; Order.findOne.mockResolvedValue({...order}); Order.findOneAndUpdate.mockResolvedValue({...order,paymentStatus:'paid'}); global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({data:session})}); });
afterAll(() => { global.fetch=originalFetch; if(originalKey===undefined)delete process.env.PAYMONGO_SECRET_KEY;else process.env.PAYMONGO_SECRET_KEY=originalKey; });
test('only finds orders owned by the authenticated customer', async()=>{
  Order.findOne.mockResolvedValue(null);
  expect((await verifyCustomerPayment('order','other')).status).toBe(404);
  expect(Order.findOne).toHaveBeenCalledWith({_id:'order',user:'other'});
  expect(global.fetch).not.toHaveBeenCalled();
});
test('confirms paid status only from authenticated PayMongo response',async()=>{
  expect((await verifyCustomerPayment('order','customer')).status).toBe(200);
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.paymongo.com/v1/checkout_sessions/cs_test');
  expect(Order.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({paymentStatus:'pending'}),expect.objectContaining({$set:expect.objectContaining({paymentStatus:'paid',paymentAmount:100,paymentReference:'pay_test'})}),expect.any(Object));
});
test.each([
  {...session,id:'wrong'},
  {...session,attributes:{...session.attributes,livemode:true}},
  {...session,attributes:{...session.attributes,reference_number:'OTHER'}},
  {...session,attributes:{...session.attributes,payments:[{id:'pay',attributes:{status:'paid',amount:9900,currency:'PHP'}}]}},
  {...session,attributes:{...session.attributes,payments:[{id:'pay',attributes:{status:'paid',amount:10000,currency:'USD'}}]}},
])('rejects mismatched provider session details',async(value)=>{
  global.fetch.mockResolvedValue({ok:true,json:async()=>({data:value})});
  expect((await verifyCustomerPayment('order','customer')).status).toBe(400);
  expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
});
test('unpaid provider session stays pending',async()=>{
  global.fetch.mockResolvedValue({ok:true,json:async()=>({data:{...session,attributes:{...session.attributes,payments:[]}}})});
  expect((await verifyCustomerPayment('order','customer')).status).toBe(200);
  expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
});

