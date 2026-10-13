const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/AuthController');
const { requireToken, requireCustomer } = require('../middlewares/AuthMiddleware');

//=======================//
// CUSTOMER REGISTRATION //
//=======================//

router.post('/register-customer', AuthController.registerCustomer);

//============//
// USER LOGIN //
//============//

router.post('/login', AuthController.login);
router.post('/google', AuthController.googleLogin);
router.patch('/profile', requireToken, requireCustomer, AuthController.updateProfile);

module.exports = router;
