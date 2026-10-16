const { resolveOptions } = require('../utils/CoffeeOptions');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const VoucherInstance = require('../models/VoucherInstance');
const User = require('../models/User');
const OrderResponses = require('../responses/OrderResponses');
const GenericResponses = require('../responses/GenericResponses');
const LogUtils = require('../utils/LogUtils');
const PaymongoService = require('./PaymongoService');
const { notifyOrder } = require('./NotificationService');
const {
  ORDER_STATUS,
  PAYMENT_STATUS,
  ORDER_STATUS_TRANSITIONS,
} = require('../constants/OrderConstants');
const { PRODUCT_STATUS } = require('../constants/ProductConstants');
const { VOUCHER_STATUS, DISCOUNT_TYPE } = require('../constants/VoucherConstants');

const isId = (id) => mongoose.isValidObjectId(id);
const now = () => new Date();

const orderNumber = async () => {
  for (let i = 0; i < 5; i++) {
    const value = `ORD-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

    if (!(await Order.exists({ orderNumber: value }))) {
      return value;
    }
  }

  throw new Error('Unable to generate unique order number.');
};

const validateAddress = (address = {}) => {
  const fields = [
    'latitude',
    'longitude',
    'street',
    'barangay',
    'city',
    'province',
  ];

  const missing = fields.filter(
    (field) =>
      address[field] === undefined ||
      address[field] === null ||
      (typeof address[field] === 'string' && !address[field].trim())
  );

  const invalid = [];

  if (
    typeof address.latitude !== 'number' ||
    address.latitude < -90 ||
    address.latitude > 90
  ) {
    invalid.push('latitude');
  }

  if (
    typeof address.longitude !== 'number' ||
    address.longitude < -180 ||
    address.longitude > 180
  ) {
    invalid.push('longitude');
  }

  return { missing, invalid };
};

const aggregateRequirements = (items) => {
  const requirements = new Map();

  for (const item of items) {
    const main = String(item.product);
    requirements.set(main, (requirements.get(main) || 0) + item.quantity);

    for (const addon of item.addons || []) {
      const id = String(addon.addon);
      requirements.set(
        id,
        (requirements.get(id) || 0) + addon.quantity * item.quantity
      );
    }
  }

  return requirements;
};

const reserveStock = async (requirements) => {
  const changed = [];

  try {
    for (const [id, quantity] of requirements) {
      const product = await Product.findOneAndUpdate(
        {
          _id: id,
          status: PRODUCT_STATUS.AVAILABLE,
          stock: { $gte: quantity },
        },
        { $inc: { stock: -quantity } },
        { new: true }
      );

      if (!product) {
        throw new Error(`INSUFFICIENT_STOCK:${id}`);
      }

      changed.push({
        id,
        quantity,
        previousStatus:
          product.stock + quantity > 0
            ? PRODUCT_STATUS.AVAILABLE
            : PRODUCT_STATUS.OUT_OF_STOCK,
      });

      if (product.stock === 0) {
        await Product.updateOne(
          { _id: id },
          { $set: { status: PRODUCT_STATUS.OUT_OF_STOCK } }
        );
      }
    }

    return null;
  } catch (error) {
    for (const item of changed) {
      await Product.updateOne(
        { _id: item.id },
        {
          $inc: { stock: item.quantity },
          $set: { status: item.previousStatus },
        }
      );
    }

    return error;
  }
};

const restoreStock = async (order) => {
  const requirements = aggregateRequirements(order.products);

  for (const [id, quantity] of requirements) {
    const product = await Product.findById(id);

    if (!product) {
      continue;
    }

    const stock = product.stock + quantity;
    const status =
      product.status === PRODUCT_STATUS.OUT_OF_STOCK
        ? PRODUCT_STATUS.AVAILABLE
        : product.status;

    await Product.updateOne(
      { _id: id },
      {
        $inc: { stock: quantity },
        $set: { status },
      }
    );
  }
};

const validateAndPriceItems = async (items) => {
  if (!Array.isArray(items) || !items.length || items.some(item => !item || typeof item !== 'object' || (item.addons !== undefined && (!Array.isArray(item.addons) || item.addons.some(addon => !addon || typeof addon !== 'object'))))) {
    return { invalid: ['products'] };
  }

  const productIds = items.flatMap((item) => [
    item.product,
    ...(item.addons || []).map((addon) => addon.addon),
  ]);

  if (productIds.some((id) => !isId(id))) {
    return { invalid: ['products'] };
  }

  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const invalid = [];
  const priced = [];

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      invalid.push('products');
      continue;
    }

    const product = byId.get(String(item.product));

    if (
      !product ||
      product.isAddon ||
      product.status !== PRODUCT_STATUS.AVAILABLE
    ) {
      invalid.push('products');
      continue;
    }

    const resolved = resolveOptions(product, item.options);
    if (resolved.error) { invalid.push('products.options'); continue; }

    const configured = new Map(
      (product.allowedAddons || []).map((entry) => [String(entry.addon), entry])
    );
    const requestedAddons = new Map();

    for (const addonItem of item.addons || []) {
      const id = String(addonItem.addon);
      requestedAddons.set(
        id,
        (requestedAddons.get(id) || 0) + addonItem.quantity
      );
    }

    for (const [id, rule] of configured) {
      if ((requestedAddons.get(id) || 0) < rule.minQuantity) {
        invalid.push('products');
      }
    }

    const addons = [];

    for (const [id, quantity] of requestedAddons) {
      const addon = byId.get(id);
      const rule = configured.get(id);

      if (
        !addon ||
        !addon.isAddon ||
        !rule ||
        !Number.isInteger(quantity) ||
        quantity < rule.minQuantity ||
        quantity > rule.maxQuantity
      ) {
        invalid.push('products');
        continue;
      }

      addons.push({
        addon: addon._id,
        addonPrice: addon.price,
        quantity,
      });
    }

    priced.push({
      product: product._id,
      productPrice: resolved.unitPrice,
      productName: product.name,
      options: resolved.options,
      addons,
      quantity: item.quantity,
    });
  }

  return invalid.length
    ? { invalid: [...new Set(invalid)] }
    : { items: priced };
};

const roundCurrency = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

const calculateVoucherDiscount = (voucher, items, orderSubtotal, remainingTotal) => {
  if (orderSubtotal < voucher.minOrderValue) {
    return 0;
  }

  const eligibleItems = voucher.allowedProducts?.length
    ? items.filter((item) => voucher.allowedProducts.some((rule) =>
      String(item.product) === String(rule.product) &&
      item.quantity >= rule.minQuantity &&
      (rule.addons || []).every((required) =>
        (item.addons || []).some((addon) => String(addon.addon) === String(required.addon) && addon.quantity >= required.quantity)
      )
    ))
    : items;
  const eligibleSubtotal = roundCurrency(eligibleItems.reduce((sum, item) =>
    sum + item.productPrice * item.quantity + (item.addons || []).reduce((addonSum, addon) => addonSum + addon.addonPrice * addon.quantity * item.quantity, 0), 0));
  if (!eligibleSubtotal) return 0;

  const raw =
    voucher.discountType === DISCOUNT_TYPE.PERCENTAGE
      ? eligibleSubtotal * (voucher.discountValue / 100)
      : voucher.discountValue;

  return roundCurrency(Math.min(raw, voucher.maxDiscountValue, eligibleSubtotal, remainingTotal));
};

const applyVouchers = async (voucherIds, userId, items, totalPrice) => {
  if (voucherIds === undefined || voucherIds === null) {
    return { vouchersApplied: [], discount: 0 };
  }

  if (!Array.isArray(voucherIds) || voucherIds.some((id) => !isId(id))) {
    return { error: 'Invalid voucher IDs.' };
  }
  if (!voucherIds.length) return { vouchersApplied: [], discount: 0 };

  const unique = [...new Set(voucherIds.map(String))];
  if (unique.length !== voucherIds.length) return { error: 'A voucher can only be selected once.' };
  if (unique.length > 3) return { error: 'Apply up to three vouchers per order.' };
  const foundVouchers = await VoucherInstance.find({
    _id: { $in: unique },
    owner: userId,
  });

  if (foundVouchers.length !== unique.length) {
    return { error: 'One or more vouchers do not belong to this customer.' };
  }
  const voucherById = new Map(foundVouchers.map((voucher) => [String(voucher._id), voucher]));
  const vouchers = unique.map((id) => voucherById.get(id));

  if (vouchers.some((instance) => instance.voucher.newCustomersOnly)) {
    const previousOrder = await Order.exists({
      user: userId,
      status: { $ne: ORDER_STATUS.CANCELLED },
    });
    if (previousOrder) {
      return { error: 'This voucher is for new customers placing their first order.' };
    }
  }

  const applied = [];
  let discount = 0;

  for (const instance of vouchers) {
    if (
      instance.status !== VOUCHER_STATUS.ACTIVE ||
      instance.expiresAt <= now()
    ) {
      return {
        error: `Voucher ${instance.voucher.code} is unavailable.`,
      };
    }

    const amount = calculateVoucherDiscount(instance.voucher, items, totalPrice, Math.max(totalPrice - discount, 0));

    if (amount <= 0) {
      return {
        error: `Voucher ${instance.voucher.code} does not apply to this order.`,
      };
    }

    applied.push({
      voucher: instance._id,
      discountAmount: amount,
    });
    discount += amount;
  }

  return { vouchersApplied: applied, discount: roundCurrency(discount) };
};

const previewVoucherApplication = async (data, userId) => {
  const priced = await validateAndPriceItems(data?.products);
  if (priced.invalid) return OrderResponses.invalidData(priced.invalid, 'Review your cart before applying vouchers.');
  const subtotal = roundCurrency(priced.items.reduce((sum, item) => sum + item.productPrice * item.quantity + item.addons.reduce((addonSum, addon) => addonSum + addon.addonPrice * addon.quantity * item.quantity, 0), 0));
  const result = await applyVouchers(data?.voucherIds || [], userId, priced.items, subtotal);
  if (result.error) return OrderResponses.voucherInvalid(result.error);
  return OrderResponses.success({ subtotal, discount: result.discount, total: roundCurrency(Math.max(0, subtotal - result.discount)), vouchersApplied: result.vouchersApplied }, 'Voucher discount calculated.');
};

const createOrder = async (data, userId) => {
  if (data?.notes !== undefined && (typeof data.notes !== 'string' || data.notes.length > 500)) return OrderResponses.invalidData(['notes']);
  if (data?.deliveryAddress !== undefined && data.deliveryAddress !== null) {
    const { missing, invalid } = validateAddress(data.deliveryAddress);

    if (missing.length) {
      return OrderResponses.missingData([`deliveryAddress.${missing[0]}`]);
    }

    if (invalid.length) {
      return OrderResponses.invalidData(
        invalid.map((field) => `deliveryAddress.${field}`)
      );
    }
  }

  if (!data?.products?.length) {
    return OrderResponses.missingData(['products']);
  }

  if (!data.paymentMethod) {
    return OrderResponses.missingData(['paymentMethod']);
  }

  if (!['cash', 'online'].includes(data.paymentMethod)) {
    return OrderResponses.invalidData(['paymentMethod'], 'Choose cash on delivery or configured online checkout.');
  }
  const priced = await validateAndPriceItems(data.products);

  if (priced.invalid) {
    return OrderResponses.invalidData(priced.invalid);
  }

  const totalPrice = roundCurrency(priced.items.reduce(
    (sum, item) =>
      sum +
      item.productPrice * item.quantity +
      item.addons.reduce(
        (s, a) => s + a.addonPrice * a.quantity * item.quantity,
        0
      ),
    0
  ));

  const voucherResult = await applyVouchers(
    data.voucherIds || [],
    userId,
    priced.items,
    totalPrice
  );

  if (voucherResult.error) {
    return OrderResponses.voucherInvalid(voucherResult.error);
  }

  const grandTotal = roundCurrency(Math.max(totalPrice - voucherResult.discount, 0));
  const paymentRequired = grandTotal > 0;
  if (data.paymentMethod === 'online' && paymentRequired && !PaymongoService.isConfigured()) {
    return OrderResponses.invalidData(['paymentMethod'], 'PayMongo checkout is not configured. Choose cash on delivery.');
  }

  const stockError = await reserveStock(aggregateRequirements(priced.items));

  if (stockError) {
    return stockError.message.startsWith('INSUFFICIENT_STOCK')
      ? OrderResponses.insufficientStock()
      : GenericResponses.internalServerError();
  }

  let order;
  const reservedVoucherIds = [];
  try {
    const instanceIds = voucherResult.vouchersApplied.map(
      (item) => item.voucher
    );

    for (const id of instanceIds) {
      const reserved = await VoucherInstance.findOneAndUpdate(
        { _id: id, owner: userId, status: VOUCHER_STATUS.ACTIVE, expiresAt: { $gt: now() } },
        { $set: { status: VOUCHER_STATUS.USED } },
        { new: true }
      );
      if (!reserved) throw new Error('A selected voucher was just used or expired. Refresh your vouchers and try again.');
      reservedVoucherIds.push(id);
    }

    order = await Order.create({
      user: userId,
      orderNumber: await orderNumber(),
      products: priced.items,
      totalPrice: roundCurrency(totalPrice),
      vouchersApplied: voucherResult.vouchersApplied,
      grandTotal,
      notes: data.notes?.trim() || undefined,
      ...(data.deliveryAddress ? { deliveryAddress: data.deliveryAddress } : {}),
      paymentMethod: data.paymentMethod,
      ...(data.paymentMethod === 'online' ? { paymentMethodProvider: 'paymongo' } : {}),
      ...(paymentRequired ? {} : { paymentStatus: PAYMENT_STATUS.PAID, paymentAmount: 0, paymentReference: 'Fully covered by voucher', paymentMethodProvider: 'voucher', paidAt: now(), paidBy: userId }),
      pendingAt: now(),
      pendingBy: userId,
    });

    if (instanceIds.length) {
      const linked = await VoucherInstance.updateMany(
        { _id: { $in: instanceIds }, owner: userId, status: VOUCHER_STATUS.USED, usedInOrder: { $exists: false } },
        { $set: { usedAt: now(), usedInOrder: order._id } }
      );
      if (linked.modifiedCount !== instanceIds.length) throw new Error('Unable to attach voucher redemption to the order.');
    }

    if (data.paymentMethod === 'online' && paymentRequired) {
      const checkout = await PaymongoService.createCheckoutSession({
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.grandTotal,
      });
      order.paymentCheckoutSessionId = checkout.id;
      order.paymentCheckoutUrl = checkout.url;
      await order.save();
    }

    await order.populate(
        'products.product products.addons.addon vouchersApplied.voucher'
      );
    await notifyOrder(order, 'created');
    return OrderResponses.success(
      order,
      data.paymentMethod === 'online'
        && paymentRequired
        ? 'Order created. Continue to secure PayMongo checkout.'
        : paymentRequired ? 'Order created successfully.' : 'Order placed. Your voucher covered the full total; no payment is due.'
    );
  } catch (error) {
    if (order?._id) await Order.deleteOne({ _id: order._id });
    await restoreStock({ products: priced.items });
    const voucherRollbackFilter = { _id: { $in: reservedVoucherIds }, owner: userId, status: VOUCHER_STATUS.USED };
    if (order?._id) voucherRollbackFilter.$or = [{ usedInOrder: { $exists: false } }, { usedInOrder: order._id }];
    else voucherRollbackFilter.usedInOrder = { $exists: false };
    await VoucherInstance.updateMany(
      voucherRollbackFilter,
      {
        $set: { status: VOUCHER_STATUS.ACTIVE },
        $unset: { usedAt: 1, usedInOrder: 1 },
      }
    );

    if (error.message.startsWith('A selected voucher was just used or expired.')) {
      return OrderResponses.voucherInvalid(error.message);
    }

    LogUtils.logError(`Error in createOrder: ${error.message}`);
    return GenericResponses.internalServerError();
  }
};

const getCustomerOrders = async (userId) => {
  try {
    return OrderResponses.success(
      await Order.find({ user: userId })
        .populate('products.product products.addons.addon')
        .populate('vouchersApplied.voucher')
        .populate({ path: 'deliveryRider', select: '-password' })
        .sort({ createdAt: -1 })
    );
  } catch (error) {
    LogUtils.logError(`Error in getCustomerOrders: ${error.message}`);
    return GenericResponses.internalServerError();
  }
};

const getCustomerOrder = async (id, userId) => {
  if (!isId(id)) {
    return OrderResponses.invalidData(['id']);
  }

  try {
    const order = await Order.findOne({ _id: id, user: userId })
      .populate('products.product products.addons.addon')
      .populate('vouchersApplied.voucher')
      .populate({ path: 'deliveryRider', select: '-password' });

    return order
      ? OrderResponses.success(order)
      : OrderResponses.notFound();
  } catch (error) {
    LogUtils.logError(`Error in getCustomerOrder: ${error.message}`);
    return GenericResponses.internalServerError();
  }
};

const getOrders = async (filters = {}) => {
  try {
    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.deliveryRider) {
      query.deliveryRider = filters.deliveryRider;
    }

    return OrderResponses.success(
      await Order.find(query)
        .populate({ path: 'user', select: '-password' })
        .populate('products.product products.addons.addon')
        .populate('vouchersApplied.voucher')
        .populate({ path: 'deliveryRider', select: '-password' })
        .sort({ createdAt: -1 })
    );
  } catch (error) {
    LogUtils.logError(`Error in getOrders: ${error.message}`);
    return GenericResponses.internalServerError();
  }
};

const getDeliveryOrders = async (riderId, mine = false) => {
  try {
    const query = mine
      ? {
          deliveryRider: riderId,
          deliveryAddress: { $exists: true },
        }
      : {
          status: ORDER_STATUS.READY,
          deliveryAddress: { $exists: true },
          $or: [
            { deliveryRider: { $exists: false } },
            { deliveryRider: null },
          ],
        };

    return OrderResponses.success(
      await Order.find(query)
        .populate({ path: 'user', select: '-password' })
        .populate('products.product products.addons.addon')
        .populate('vouchersApplied.voucher')
        .populate({ path: 'deliveryRider', select: '-password' })
        .sort({ createdAt: 1 })
    );
  } catch (error) {
    LogUtils.logError(`Error in getDeliveryOrders: ${error.message}`);
    return GenericResponses.internalServerError();
  }
};

const getOrder = async (id) => {
  if (!isId(id)) {
    return OrderResponses.invalidData(['id']);
  }

  try {
    const order = await Order.findById(id)
      .populate({ path: 'user', select: '-password' })
      .populate('products.product products.addons.addon')
      .populate('vouchersApplied.voucher')
      .populate({ path: 'deliveryRider', select: '-password' });

    return order ? OrderResponses.success(order) : OrderResponses.notFound();
  } catch (error) {
    LogUtils.logError(`Error in getOrder: ${error.message}`);
    return GenericResponses.internalServerError();
  }
};

const changeStatus = async (id, status, userId, reason) => {
  if (!isId(id)) {
    return OrderResponses.invalidData(['id']);
  }

  const order = await Order.findById(id);

  if (!order) {
    return OrderResponses.notFound();
  }

  const isDeliveryOrder = Boolean(order.deliveryAddress);
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status];

  if (!allowedTransitions?.includes(status)) {
    return OrderResponses.invalidTransition();
  }

  if (status === ORDER_STATUS.CANCELLED && order.paymentMethod === 'online') {
    if (order.paymentStatus === PAYMENT_STATUS.PAID && order.grandTotal > 0) {
      return OrderResponses.invalidTransition('A paid online order needs a refund before it can be cancelled.');
    }
    if (order.paymentCheckoutSessionId && !(await PaymongoService.expireCheckoutSession(order.paymentCheckoutSessionId))) {
      return OrderResponses.invalidTransition('We could not confirm that the payment session is closed. Refresh the order before trying again.');
    }
  }

  if (order.paymentMethod === 'online'
    && order.paymentStatus !== PAYMENT_STATUS.PAID
    && status !== ORDER_STATUS.CANCELLED) {
    return OrderResponses.invalidTransition('Online orders cannot be fulfilled before payment is confirmed.');
  }

  if (!isDeliveryOrder && [ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED].includes(status)) {
    return OrderResponses.invalidTransition(
      'In-store orders cannot use delivery-only statuses.'
    );
  }

  if (isDeliveryOrder && status === ORDER_STATUS.CLAIMED && !order.deliveryRider) {
    return OrderResponses.invalidTransition(
      'Delivery orders must have an assigned rider before being claimed.'
    );
  }

  const stamp = now();
  const fieldMap = {
    confirmed: ['confirmedAt', 'confirmedBy'],
    queued: ['queuedAt', 'queuedBy'],
    ready: ['readyAt', 'readyBy'],
    claimed: ['claimedAt', 'claimedBy'],
    shipped: ['shippedAt', 'shippedBy'],
    delivered: ['deliveredAt', 'deliveredBy'],
    cancelled: ['cancelledAt', 'cancelledBy'],
  };

  const updates = { status };
  if (status === ORDER_STATUS.CANCELLED && typeof reason === 'string' && reason.trim()) updates.cancellationReason = reason.trim();
  if (fieldMap[status]) { updates[fieldMap[status][0]] = stamp; updates[fieldMap[status][1]] = userId; }
  // Only the request that wins this transition may restore stock or vouchers.
  const filter = { _id: order._id, status: order.status };
  if (order.paymentMethod === 'online') filter.paymentStatus = order.paymentStatus;
  const changed = await Order.findOneAndUpdate(filter, { $set: updates }, { returnDocument: 'after', runValidators: true });
  if (!changed) return OrderResponses.invalidTransition('This order changed in another session. Refresh before updating it.');

  if (status === ORDER_STATUS.CANCELLED) {
    await restoreStock(changed);

    for (const applied of changed.vouchersApplied) {
      await VoucherInstance.findOneAndUpdate(
        {
          _id: applied.voucher,
          usedInOrder: changed._id,
          status: VOUCHER_STATUS.USED,
        },
        {
          $set: { status: VOUCHER_STATUS.ACTIVE },
          $unset: { usedAt: 1, usedInOrder: 1 },
        },
        { new: true }
      );
    }
  }

  await notifyOrder(changed, `status:${status}`);
  return OrderResponses.success(changed, `Order ${status} successfully.`);
};

const cancelCustomerOrder = async (id, userId, reason) => {
  if (!isId(id)) {
    return OrderResponses.invalidData(['id']);
  }

  const order = await Order.findOne({ _id: id, user: userId });

  if (!order) {
    return OrderResponses.notFound();
  }

  if (order.status !== ORDER_STATUS.PENDING) {
    return OrderResponses.invalidTransition(
      'Customers can only cancel pending orders.'
    );
  }

  return changeStatus(id, ORDER_STATUS.CANCELLED, userId, reason);
};

const assignRider = async (id, riderId) => {
  if (!isId(id) || !isId(riderId)) {
    return OrderResponses.invalidData(['id']);
  }

  const rider = await User.findOne({
    _id: riderId,
    role: 'delivery',
  }).select('_id');

  if (!rider) {
    return OrderResponses.invalidData(['riderId']);
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: id,
      deliveryAddress: { $exists: true },
      status: {
        $in: [
          ORDER_STATUS.READY,
          ORDER_STATUS.CONFIRMED,
          ORDER_STATUS.QUEUED,
        ],
      },
      $or: [
        { deliveryRider: { $exists: false } },
        { deliveryRider: null },
        { deliveryRider: riderId },
      ],
    },
    { $set: { deliveryRider: riderId } },
    { new: true }
  );

  if (!order) {
    const existing = await Order.findById(id);

    if (!existing) {
      return OrderResponses.notFound();
    }

    if (!existing.deliveryAddress) {
      return OrderResponses.invalidTransition(
        'Only delivery orders can be assigned to a rider.'
      );
    }

    if (
      ![
        ORDER_STATUS.READY,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.QUEUED,
      ].includes(existing.status)
    ) {
      return OrderResponses.invalidTransition(
        'Only active delivery orders can be assigned.'
      );
    }

    if (
      existing.deliveryRider
      && String(existing.deliveryRider) !== String(riderId)
    ) {
      return OrderResponses.riderConflict();
    }

    return OrderResponses.notFound();
  }

  await notifyOrder(order, 'assigned');
  return OrderResponses.success(
    order,
    'Delivery rider assigned successfully.'
  );
};

const claimOrder = async (id, riderId) => {
  if (!isId(id)) {
    return OrderResponses.invalidData(['id']);
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: id,
      status: ORDER_STATUS.READY,
      deliveryAddress: { $exists: true },
      $or: [
        { deliveryRider: { $exists: false } },
        { deliveryRider: null },
        { deliveryRider: riderId },
      ],
    },
    {
      $set: {
        deliveryRider: riderId,
        status: ORDER_STATUS.CLAIMED,
        claimedAt: now(),
        claimedBy: riderId,
      },
    },
    { new: true }
  );

  if (!order) {
    const existing = await Order.findById(id);
    return existing?.deliveryRider
      ? OrderResponses.riderConflict()
      : OrderResponses.notFound();
  }

  await notifyOrder(order, 'status:claimed');
  return OrderResponses.success(order, 'Order claimed successfully.');
};

const deliveryStatus = async (id, status, riderId) => {
  if (!isId(id)) {
    return OrderResponses.invalidData(['id']);
  }

  const order = await Order.findOne({
    _id: id,
    deliveryRider: riderId,
    deliveryAddress: { $exists: true },
  });

  if (!order) {
    return OrderResponses.notFound();
  }

  if (
    status === ORDER_STATUS.SHIPPED &&
    order.status !== ORDER_STATUS.CLAIMED
  ) {
    return OrderResponses.invalidTransition();
  }

  if (
    status === ORDER_STATUS.DELIVERED &&
    order.status !== ORDER_STATUS.SHIPPED
  ) {
    return OrderResponses.invalidTransition();
  }

  return changeStatus(id, status, riderId);
};

const updatePayment = async (id, data, userId) => {
  if (!isId(id)) {
    return OrderResponses.invalidData(['id']);
  }

  const order = await Order.findById(id);

  if (!order) {
    return OrderResponses.notFound();
  }

  // Online payment state is owned by the signed PayMongo webhook. Staff can
  // record cash collection, but must not override provider payment state.
  if (order.paymentMethod === 'online') {
    return OrderResponses.invalidTransition('Online payments can only be confirmed by the PayMongo webhook.');
  }

  if (
    ![
      PAYMENT_STATUS.PAID,
      PAYMENT_STATUS.FAILED,
      PAYMENT_STATUS.PENDING,
    ].includes(data?.paymentStatus)
  ) {
    return OrderResponses.invalidData(['paymentStatus']);
  }

  if (order.paymentMethod === 'cash' && order.paymentStatus === PAYMENT_STATUS.PAID) return OrderResponses.invalidTransition('Cash collection has already been recorded.');
  if (order.paymentMethod === 'cash' && data.paymentStatus === PAYMENT_STATUS.PAID) {
    if (order.status !== ORDER_STATUS.DELIVERED) return OrderResponses.invalidTransition('Record cash only after delivery is completed.');
    const amount = data.paymentAmount;
    const change = data.paymentChange;
    const validMoney = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
    if (!validMoney(amount) || !validMoney(change) || amount < order.grandTotal || Math.round((amount - order.grandTotal) * 100) !== Math.round(change * 100)) return OrderResponses.invalidData(['paymentAmount', 'paymentChange']);
  }

  const invalidPaymentFields = [];

  if (
    data?.paymentAmount !== undefined &&
    (typeof data.paymentAmount !== 'number' || data.paymentAmount < 0)
  ) {
    invalidPaymentFields.push('paymentAmount');
  }

  if (
    data?.paymentChange !== undefined &&
    (typeof data.paymentChange !== 'number' || data.paymentChange < 0)
  ) {
    invalidPaymentFields.push('paymentChange');
  }

  if (invalidPaymentFields.length) {
    return OrderResponses.invalidData(invalidPaymentFields);
  }

  order.paymentStatus = data.paymentStatus;
  order.paymentReference = data.paymentReference?.trim();
  order.paymentMethodProvider = data.paymentMethodProvider?.trim();
  order.paymentAmount = data.paymentAmount;
  order.paymentChange = data.paymentChange;
  order.paidAt =
    data.paymentStatus === PAYMENT_STATUS.PAID ? now() : undefined;
  order.paidBy =
    data.paymentStatus === PAYMENT_STATUS.PAID ? userId : undefined;

  await order.save();

  if (order.paymentStatus === PAYMENT_STATUS.PAID) await notifyOrder(order, 'payment:paid');
  return OrderResponses.success(
    order,
    'Payment information updated successfully.'
  );
};

module.exports = {
  createOrder,
  getCustomerOrders,
  getCustomerOrder,
  getOrders,
  getDeliveryOrders,
  getOrder,
  changeStatus,
  cancelCustomerOrder,
  assignRider,
  claimOrder,
  deliveryStatus,
  updatePayment,
  previewVoucherApplication,
};
