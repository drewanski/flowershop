jest.mock('../services/NotificationService', () => ({ notifyOrder: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../models/Order', () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn() }));

const Order = require('../models/Order');
const OrderService = require('../services/OrderService');

describe('order workflow', () => {
  beforeEach(() => jest.clearAllMocks());

  test('staff can move a pending cash order to confirmed', async () => {
    const order = {
      _id: '507f1f77bcf86cd799439011',
      status: 'pending',
      paymentMethod: 'cash',
      deliveryAddress: { city: 'Manila' },
      save: jest.fn().mockResolvedValue(undefined),
    };
    Order.findById.mockResolvedValue(order);
    Order.findOneAndUpdate.mockImplementation(async(filter, update)=>Object.assign(order,update.$set));

    const result = await OrderService.changeStatus(order._id, 'confirmed', '507f1f77bcf86cd799439012');

    expect(result.code).toBe(300);
    expect(order.status).toBe('confirmed');
    expect(order.confirmedBy).toBe('507f1f77bcf86cd799439012');
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({status:'pending'}),expect.objectContaining({$set:expect.objectContaining({status:'confirmed'})}),expect.any(Object));
  });

  test('staff cannot override online payment state', async () => {
    Order.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      paymentMethod: 'online',
      paymentStatus: 'pending',
    });

    const result = await OrderService.updatePayment(
      '507f1f77bcf86cd799439011',
      { paymentStatus: 'paid' },
      '507f1f77bcf86cd799439012'
    );

    expect(result.code).not.toBe(300);
    expect(result.message).toMatch(/PayMongo webhook/i);
  });
});


test('cash collection requires completed delivery, valid tender and exact change',async()=>{
  const id='507f1f77bcf86cd799439011';const staff='507f1f77bcf86cd799439012';
  const order={_id:id,paymentMethod:'cash',paymentStatus:'pending',status:'ready',grandTotal:150,save:jest.fn()};Order.findById.mockResolvedValue(order);
  expect((await OrderService.updatePayment(id,{paymentStatus:'paid',paymentAmount:200,paymentChange:50},staff)).code).not.toBe(300);
  order.status='delivered';
  for(const data of [{paymentAmount:100,paymentChange:0},{paymentAmount:200,paymentChange:0},{paymentAmount:Infinity,paymentChange:Infinity}])expect((await OrderService.updatePayment(id,{paymentStatus:'paid',...data},staff)).code).not.toBe(300);
  expect((await OrderService.updatePayment(id,{paymentStatus:'paid',paymentAmount:200,paymentChange:50},staff)).code).toBe(300);
  expect(order.paidBy).toBe(staff);expect(order.save).toHaveBeenCalledTimes(1);
  expect((await OrderService.updatePayment(id,{paymentStatus:'paid',paymentAmount:200,paymentChange:50},staff)).code).not.toBe(300);
});
test('unpaid online orders cannot enter preparation',async()=>{
  const order={_id:'507f1f77bcf86cd799439011',status:'pending',paymentMethod:'online',paymentStatus:'pending',deliveryAddress:{city:'Manila'},save:jest.fn()};Order.findById.mockResolvedValue(order);
  expect((await OrderService.changeStatus(order._id,'confirmed','507f1f77bcf86cd799439012')).code).not.toBe(300);
  expect(order.save).not.toHaveBeenCalled();
});

test('a stale status update is rejected before cancellation side effects',async()=>{
  const order={_id:'507f1f77bcf86cd799439011',status:'pending',paymentMethod:'cash',vouchersApplied:[],products:[]};Order.findById.mockResolvedValue(order);Order.findOneAndUpdate.mockResolvedValue(null);
  const result=await OrderService.changeStatus(order._id,'cancelled','507f1f77bcf86cd799439012','Duplicate request');
  expect(result.code).not.toBe(300);expect(result.message).toMatch(/another session/i);
});

