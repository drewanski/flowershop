const AuthRoutes = require('./AuthRoutes');
const ProductRoutes = require('./ProductRoutes');
const OrderRoutes = require('./OrderRoutes');
const VoucherRoutes = require('./VoucherRoutes');
const AdminRoutes = require('./AdminRoutes');
const ContactRoutes = require('./ContactRoutes');
const PaymentRoutes = require('./PaymentRoutes');
const LocationRoutes = require('./LocationRoutes');

const initializeRoutes = (app) => {
  app.use('/api/auth', AuthRoutes);
  app.use('/api/products', ProductRoutes);
  app.use('/api/orders', OrderRoutes);
  app.use('/api/vouchers', VoucherRoutes);
  app.use('/api/admin', AdminRoutes);
  app.use('/api/contact', ContactRoutes);
  app.use('/api/payments', PaymentRoutes);
  app.use('/api/locations', LocationRoutes);
  app.use('/api/notifications', require('./NotificationRoutes'));
};

module.exports = {
  initializeRoutes,
};
