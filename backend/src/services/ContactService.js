const ContactMessage = require('../models/ContactMessage');
const { isValidEmail } = require('../utils/UserUtils');

const createMessage = async (data = {}) => {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';

  if (!name || !email || !message) {
    return { status: 400, message: 'Name, email, and message are required.' };
  }
  if (!isValidEmail(email) || name.length > 100 || message.length > 5000) {
    return { status: 400, message: 'Contact details are invalid or too long.' };
  }

  await ContactMessage.create({ name, email, message });
  return { status: 201, message: 'Message received.' };
};

module.exports = { createMessage };