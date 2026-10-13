const ContactService = require('../services/ContactService');

const createMessage = async (req, res) => {
  try {
    const result = await ContactService.createMessage(req.body);
    return res.status(result.status).json({ message: result.message });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save your message.' });
  }
};

module.exports = { createMessage };