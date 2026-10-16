const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  // Inbox polling has its own bounded budget; it must not exhaust checkout/login API limits.
  skip: req => req.method === 'GET' && /^\/notifications\/?$/.test(req.path),
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again shortly.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again later.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many messages submitted. Please try again later.' },
});

module.exports = { apiLimiter, authLimiter, registrationLimiter, contactLimiter };
