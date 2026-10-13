const AuthRoutes = require('./AuthRoutes');
const ProductRoutes = require('./ProductRoutes');
const OrderRoutes = require('./OrderRoutes');
const VoucherRoutes = require('./VoucherRoutes');
const AdminRoutes = require('./AdminRoutes');
const ContactRoutes = require('./ContactRoutes');

const initializeRoutes = (app) => {
  app.use('/api/auth', AuthRoutes);
  app.use('/api/products', ProductRoutes);
  app.use('/api/orders', OrderRoutes);
  app.use('/api/vouchers', VoucherRoutes);
  app.use('/api/admin', AdminRoutes);
  app.use('/api/contact', ContactRoutes);
};

module.exports = {
  initializeRoutes,
};
