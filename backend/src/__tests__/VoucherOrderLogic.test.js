jest.mock('../services/NotificationService', () => ({ notifyOrder: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../models/Product', () => ({ find: jest.fn() }));
jest.mock('../models/VoucherInstance', () => ({ find: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/Order', () => ({ exists: jest.fn() }));

const Product = require('../models/Product');
const VoucherInstance = require('../models/VoucherInstance');
const Order = require('../models/Order');
const OrderService = require('../services/OrderService');

const ids = [
  '507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012',
  '507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014',
  '507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016',
];

describe('voucher order pricing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Order.exists.mockResolvedValue(null);
    Product.find.mockResolvedValue([
      { _id: ids[0], price: 100, status: 'available', isAddon: false, allowedAddons: [] },
      { _id: ids[1], price: 200, status: 'available', isAddon: false, allowedAddons: [] },
    ]);
  });

  test('previews discount only against eligible products using current server prices', async () => {
    VoucherInstance.find.mockResolvedValue([{
      _id: ids[2], owner: ids[5], status: 'active', expiresAt: new Date(Date.now() + 60000),
      voucher: { code: 'TENOFF', discountType: 'percentage', discountValue: 10, minOrderValue: 250, maxDiscountValue: 50, allowedProducts: [{ product: ids[0], minQuantity: 1, addons: [] }] },
    }]);

    const result = await OrderService.previewVoucherApplication({ voucherIds: [ids[2]], products: [
      { product: ids[0], quantity: 1, addons: [] }, { product: ids[1], quantity: 1, addons: [] },
    ] }, ids[5]);

    expect(result.code).toBe(300);
    expect(result.payload).toMatchObject({ subtotal: 300, discount: 10, total: 290 });
  });

  test('refuses an ineligible voucher and caps voucher stacking at three', async () => {
    VoucherInstance.find.mockResolvedValue([{
      _id: ids[2], owner: ids[5], status: 'active', expiresAt: new Date(Date.now() + 60000),
      voucher: { code: 'ONLYFLOWERS', discountType: 'fixed', discountValue: 20, minOrderValue: 0, maxDiscountValue: 20, allowedProducts: [{ product: ids[3], minQuantity: 1, addons: [] }] },
    }]);
    const ineligible = await OrderService.previewVoucherApplication({ voucherIds: [ids[2]], products: [{ product: ids[0], quantity: 1, addons: [] }] }, ids[5]);
    expect(ineligible.code).toBe(306);

    const instances = ids.slice(2, 6).map((id) => ({ _id: id, owner: ids[5], status: 'active', expiresAt: new Date(Date.now() + 60000), voucher: { code: 'CODE', discountType: 'fixed', discountValue: 1, minOrderValue: 0, maxDiscountValue: 1, allowedProducts: [] } }));
    VoucherInstance.find.mockResolvedValue(instances);
    const tooMany = await OrderService.previewVoucherApplication({ voucherIds: ids.slice(2, 6), products: [{ product: ids[0], quantity: 1, addons: [] }] }, ids[5]);
    expect(tooMany.code).toBe(306);
    expect(tooMany.message).toMatch(/three vouchers/i);
  });

  test('allows a first-order voucher for new customers and rejects it for returning customers', async () => {
    const instance = {
      _id: ids[2], owner: ids[5], status: 'active', expiresAt: new Date(Date.now() + 60000),
      voucher: { code: 'WELCOME10', newCustomersOnly: true, discountType: 'percentage', discountValue: 10, minOrderValue: 0, maxDiscountValue: 50, allowedProducts: [] },
    };
    VoucherInstance.find.mockResolvedValue([instance]);
    const input = { voucherIds: [ids[2]], products: [{ product: ids[0], quantity: 1, addons: [] }] };
    const firstOrder = await OrderService.previewVoucherApplication(input, ids[5]);
    expect(firstOrder.code).toBe(300);
    expect(firstOrder.payload.discount).toBe(10);
    expect(Order.exists).toHaveBeenCalledWith({ user: ids[5], status: { $ne: 'cancelled' } });

    Order.exists.mockResolvedValue({ _id: ids[4] });
    const returningCustomer = await OrderService.previewVoucherApplication(input, ids[5]);
    expect(returningCustomer.code).toBe(306);
    expect(returningCustomer.message).toMatch(/new customers/i);
  });
});

