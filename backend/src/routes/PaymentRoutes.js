const express = require('express');
const PaymentController = require('../controllers/PaymentController');
const { requireToken, requireCustomer } = require('../middlewares/AuthMiddleware');

const router = express.Router();
router.get('/methods', PaymentController.getMethods);
router.post('/orders/:id/verify', requireToken, requireCustomer, PaymentController.verifyPayment);

module.exports = router;
