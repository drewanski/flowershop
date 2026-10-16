const PaymongoService = require('../services/PaymongoService');

const getMethods = (req, res) => res.json({
  payload: PaymongoService.isConfigured() ? ['cash', 'online'] : ['cash'],
  message: 'Available payment methods.',
});

const paymongoWebhook = async (req, res) => {
  const result = await PaymongoService.processWebhook(req.rawBody, req.get('Paymongo-Signature'));
  return res.status(result.status).json({ message: result.message });
};

const verifyPayment = async (req, res) => {
  if (!require('mongoose').isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order.' });
  try {
    const result = await PaymongoService.verifyCustomerPayment(req.params.id, req.user._id);
    return res.status(result.status).json({ message: result.message });
  } catch { return res.status(502).json({ message: 'Payment verification is temporarily unavailable. Please retry.' }); }
};

module.exports = { getMethods, paymongoWebhook, verifyPayment };
