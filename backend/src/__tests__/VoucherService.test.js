jest.mock('../models/VoucherTemplate', () => ({ create: jest.fn(), find: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/VoucherInstance', () => ({ create: jest.fn(), countDocuments: jest.fn(), exists: jest.fn(), updateMany: jest.fn() }));
jest.mock('../models/VoucherClaimCounter', () => ({ create: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../models/Order', () => ({ exists: jest.fn() }));

const VoucherTemplate = require('../models/VoucherTemplate');
const VoucherInstance = require('../models/VoucherInstance');
const VoucherClaimCounter = require('../models/VoucherClaimCounter');
const Order = require('../models/Order');
const VoucherService = require('../services/VoucherService');

const userId = '507f1f77bcf86cd799439011';
const templateId = '507f1f77bcf86cd799439012';
const definition = {
  voucher: { code: ' bloom_10 ', name: 'Bloom offer', description: 'Flowers discount', termsAndConditions: 'One per customer', discountType: 'percentage', discountValue: 10, minOrderValue: 0, maxDiscountValue: 500, allowedProducts: [] },
  startDate: new Date(Date.now() - 60000).toISOString(), endDate: new Date(Date.now() + 3600000).toISOString(), usageLimitPublic: 2, usageLimitPerUser: 1,
};

describe('voucher lifecycle rules', () => {
  beforeEach(() => { jest.clearAllMocks(); Order.exists.mockResolvedValue(null); });

  test('normalizes voucher codes before storing them', async () => {
    VoucherTemplate.create.mockImplementation(async (payload) => payload);
    const result = await VoucherService.createVoucher(definition, userId);
    expect(result.code).toBe(400);
    expect(VoucherTemplate.create.mock.calls[0][0].voucher.code).toBe('BLOOM_10');
  });

  test('claims normalized codes and atomically respects the public claim limit', async () => {
    const template = { _id: templateId, voucher: { code: 'BLOOM_10' }, startDate: new Date(Date.now() - 60000), endDate: new Date(Date.now() + 3600000), usageLimitPublic: 2, usageLimitPerUser: 1 };
    VoucherTemplate.findOne.mockResolvedValue(template);
    VoucherTemplate.findOneAndUpdate.mockResolvedValue({ ...template, usageCountPublic: 1 });
    VoucherInstance.countDocuments.mockResolvedValue(0);
    VoucherInstance.updateMany.mockResolvedValue({ modifiedCount: 0 });
    VoucherInstance.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439013' });
    VoucherClaimCounter.findOne.mockResolvedValue(null);
    VoucherClaimCounter.create.mockResolvedValue({});
    VoucherClaimCounter.findOneAndUpdate.mockResolvedValue({ claimCount: 1 });

    const result = await VoucherService.claimVoucher(' bloom_10 ', userId);
    expect(result.code).toBe(400);
    expect(VoucherTemplate.findOne.mock.calls[0][0]['voucher.code']).toBe('BLOOM_10');
    expect(VoucherTemplate.findOneAndUpdate.mock.calls[0][0].usageCountPublic).toEqual({ $lt: 2 });
    expect(VoucherInstance.create.mock.calls[0][0].owner).toBe(userId);
    expect(VoucherClaimCounter.findOneAndUpdate.mock.calls[0][0].claimCount).toEqual({ $lt: 1 });
  });

  test('rejects a claim when the customer already reached their lifetime claim limit', async () => {
    VoucherTemplate.findOne.mockResolvedValue({ _id: templateId, voucher: { code: 'BLOOM_10' }, startDate: new Date(Date.now() - 60000), endDate: new Date(Date.now() + 3600000), usageLimitPublic: 2, usageLimitPerUser: 1 });
    VoucherClaimCounter.findOne.mockResolvedValue({ claimCount: 1 });
    VoucherClaimCounter.findOneAndUpdate.mockResolvedValue(null);
    const result = await VoucherService.claimVoucher('BLOOM_10', userId);
    expect(result.code).toBe(405);
    expect(VoucherTemplate.findOneAndUpdate).not.toHaveBeenCalled();
    expect(VoucherInstance.create).not.toHaveBeenCalled();
  });

  test('blocks returning customers from claiming a first-order voucher', async () => {
    VoucherTemplate.findOne.mockResolvedValue({
      _id: templateId,
      voucher: { code: 'WELCOME10', newCustomersOnly: true },
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 3600000),
      usageLimitPublic: 0,
      usageLimitPerUser: 1,
    });
    Order.exists.mockResolvedValue({ _id: '507f1f77bcf86cd799439099' });
    const result = await VoucherService.claimVoucher('WELCOME10', userId);
    expect(result.code).toBe(405);
    expect(result.message).toMatch(/new customers/i);
    expect(VoucherInstance.create).not.toHaveBeenCalled();
    expect(VoucherClaimCounter.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('lists the first-order campaign for a new customer and hides it from a returning customer', async () => {
    const campaign = {
      _id: templateId,
      voucher: { code: 'WELCOME10', newCustomersOnly: true },
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 3600000),
      usageLimitPerUser: 1,
    };
    VoucherTemplate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([campaign]) });
    VoucherClaimCounter.findOne.mockResolvedValue({ claimCount: 0 });
    VoucherInstance.exists.mockResolvedValue(null);
    Order.exists.mockResolvedValue(null);

    const firstOrderOffers = await VoucherService.getAvailableVoucherCampaigns(userId);
    expect(firstOrderOffers.payload).toHaveLength(1);
    expect(firstOrderOffers.payload[0].voucher.code).toBe('WELCOME10');

    Order.exists.mockResolvedValue({ _id: '507f1f77bcf86cd799439099' });
    const returningCustomerOffers = await VoucherService.getAvailableVoucherCampaigns(userId);
    expect(returningCustomerOffers.payload).toHaveLength(1);
    expect(returningCustomerOffers.payload[0]).toMatchObject({ claimable: false, eligibilityReason: expect.stringMatching(/first non-cancelled order/i) });
  });
});
