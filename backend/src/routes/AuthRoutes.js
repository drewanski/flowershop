const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/AuthController');
const { requireToken, requireCustomer } = require('../middlewares/AuthMiddleware');
const { authLimiter, registrationLimiter } = require('../middlewares/RateLimitMiddleware');

//=======================//
// CUSTOMER REGISTRATION //
//=======================//

router.post('/register-customer', registrationLimiter, AuthController.registerCustomer);

//============//
// USER LOGIN //
//============//

router.post('/login', authLimiter, AuthController.login);
router.post('/google', authLimiter, AuthController.googleLogin);
router.post('/password-reset/request', authLimiter, AuthController.requestPasswordReset);
router.post('/password-reset/confirm', authLimiter, AuthController.confirmPasswordReset);
router.patch('/profile', requireToken, requireCustomer, AuthController.updateProfile);

module.exports = router;
