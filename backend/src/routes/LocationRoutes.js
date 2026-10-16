const express = require('express');
const { rateLimit } = require('express-rate-limit');
const LocationController = require('../controllers/LocationController');

const router = express.Router();
const searchLimiter = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
router.post('/geocode', searchLimiter, LocationController.geocode);
router.post('/reverse', searchLimiter, LocationController.reverseGeocode);

module.exports = router;
