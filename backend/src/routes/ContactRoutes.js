const express = require('express');
const ContactController = require('../controllers/ContactController');
const { contactLimiter } = require('../middlewares/RateLimitMiddleware');

const router = express.Router();
router.post('/', contactLimiter, ContactController.createMessage);

module.exports = router;