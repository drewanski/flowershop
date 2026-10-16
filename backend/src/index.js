const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');

const routes = require('./routes');
const { apiLimiter } = require('./middlewares/RateLimitMiddleware');
const PaymentController = require('./controllers/PaymentController');

//===============//
// DOTENV CONFIG //
//===============//

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';

const CORS_ORIGINS = process.env.CORS_ORIGINS?
  process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()):
  ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:8081'];
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop';
const PORT = process.env.PORT || 5000;
const TRUST_PROXY_HOPS = process.env.TRUST_PROXY_HOPS === undefined
  ? null
  : Number(process.env.TRUST_PROXY_HOPS);

if (!JWT_SECRET) 
  throw new Error('JWT_SECRET is not defined in the environment variables. Please set it in your .env file.');

if (NODE_ENV === 'production') {
  if (JWT_SECRET.length < 32 || JWT_SECRET === 'coffee-shop-dev-secret' || JWT_SECRET === 'your_jwt_secret') {
    throw new Error('Production JWT_SECRET must be a unique random value of at least 32 characters.');
  }
  if (!CORS_ORIGINS.length || CORS_ORIGINS.includes('*')) {
    throw new Error('Production CORS_ORIGINS must contain explicit trusted origins.');
  }
  if (TRUST_PROXY_HOPS !== null && (!Number.isInteger(TRUST_PROXY_HOPS) || TRUST_PROXY_HOPS < 0 || TRUST_PROXY_HOPS > 5)) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5.');
  }
}

if (NODE_ENV === 'development') {
  console.log('==========================');
  console.log(`Environment     : ${NODE_ENV}`);
  console.log(`MongoDB         : ${MONGODB_URI.startsWith('mongodb+srv://') ? 'MongoDB Atlas' : 'Local/Configured MongoDB'}`);
  console.log(`Allowed Origins : ${CORS_ORIGINS.join(', ')}`);
  console.log(`Port            : ${PORT}`);
  console.log('==========================');
}

//====================//
// CONNECT TO MONGODB //
//====================//

mongoose.connect(MONGODB_URI).then(() => {
  console.log('Connected to MongoDB');
  startServer();
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
  process.exit(1);
});

//==================================//
// INITIALIZE EXPRESS AND SOCKET.IO //
//==================================//

const startServer = () => {
  const app = express();
  if (TRUST_PROXY_HOPS !== null) app.set('trust proxy', TRUST_PROXY_HOPS);
  app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
  app.use('/api', apiLimiter);
  app.use('/api/payments/paymongo/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
    req.rawBody = req.body;
    next();
  }, PaymentController.paymongoWebhook);
  app.use(express.json({
    limit: '1mb',
    verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); },
  }));

  // TODO: Add routes setup here
  // Import route folder's index.js and use an initializer function.
  routes.initializeRoutes(app);

  app.get('/health', (req, res) => {
    res.sendStatus(200);
  });

  const server = http.createServer(app);

  // TODO: Add socket.io setup here
  // Import socket folder's index.js and use an initializer function.
  // Example: const initializeSocket = require('./socket'); initializeSocket(server);

  // START SERVER //

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}