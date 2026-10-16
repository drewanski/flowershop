jest.mock('../models/Notification', () => ({ bulkWrite: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/User', () => ({ find: jest.fn() }));
jest.mock('../utils/LogUtils', () => ({ logError: jest.fn() }));
const Notification = require('../models/Notification');
const User = require('../models/User');
const { notifyOrder } = require('../services/NotificationService');
const order = { _id: 'order', user: 'customer', orderNumber: 'ORD-TEST', status: 'pending', paymentMethod: 'cash', deliveryAddress: {city:'Manila'} };
const writes = () => Notification.bulkWrite.mock.calls[0][0].map(op => op.updateOne.update.$setOnInsert);
beforeEach(() => {
  jest.clearAllMocks(); Notification.bulkWrite.mockResolvedValue({});
  User.find.mockImplementation(({role}) => ({ select: () => ({lean: async () => role.$in.map(r => ({_id:r,role:r}))}) }));
});
test('new order reaches only its customer and operations roles', async () => {
  await notifyOrder(order,'created');
  expect(writes().map(n=>n.recipient)).toEqual(['customer','admin','manager','crew']);
  expect(User.find).toHaveBeenCalledWith({role:{$in:['admin','manager','crew']},isDisabled:{$ne:true}});
});
test('unassigned ready order alerts available riders; no address is leaked', async () => {
  await notifyOrder({...order,status:'ready'},'status:ready');
  expect(writes().map(n=>n.recipient)).toEqual(['customer','delivery']);
  expect(writes()[1].deliveryView).toBe('available');
  expect(writes()[1].message).not.toContain('Manila');
});
test('assigned ready order targets its rider instead of all riders', async () => {
  await notifyOrder({...order,deliveryRider:'rider-one'},'status:ready');
  expect(writes().map(n=>n.recipient)).toEqual(['customer','rider-one']);
  expect(User.find).not.toHaveBeenCalled();
});
test('payment retry uses the same unique key without overwriting read state', async () => {
  await notifyOrder(order,'payment:paid'); await notifyOrder(order,'payment:paid');
  expect(Notification.bulkWrite.mock.calls[0][0]).toEqual(Notification.bulkWrite.mock.calls[1][0]);
  expect(Notification.bulkWrite.mock.calls[0][0][0].updateOne.filter).toEqual({recipient:'customer',eventKey:'order:payment:paid'});
  expect(Notification.bulkWrite.mock.calls[0][0][0].updateOne.update.$set).toBeUndefined();
});
test('notification storage failure does not reject a successful business operation', async () => {
  Notification.bulkWrite.mockRejectedValue(new Error('storage unavailable'));
  await expect(notifyOrder(order,'status:delivered')).resolves.toBeUndefined();
});
