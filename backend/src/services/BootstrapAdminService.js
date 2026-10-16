const crypto = require('crypto');
const User = require('../models/User');
const { encryptPassword } = require('../utils/AuthUtils');

const bootstrapAdminIfMissing = async () => {
  const existingAdmin = await User.exists({ role: 'admin' });
  if (existingAdmin) return null;

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@coffeeshop.local').trim().toLowerCase();
  const password = crypto.randomBytes(24).toString('base64url');
  const suffix = crypto.randomBytes(6).toString('hex');
  const contactNumber = `09${String(crypto.randomInt(100000000, 999999999)).padStart(9, '0')}`;

  // Never overwrite an existing account if this configured email is already taken.
  const existingEmail = await User.exists({ email });
  if (existingEmail) {
    throw new Error(`Cannot bootstrap administrator: ${email} is already assigned to a non-admin account. Set BOOTSTRAP_ADMIN_EMAIL to an unused address or promote an existing account manually.`);
  }

  try {
    await User.create({
      firstName: 'Default',
      lastName: 'Administrator',
      contactNumber,
      username: `bootstrapadmin${suffix}`,
      email,
      password: await encryptPassword(password),
      role: 'admin',
    });
  } catch (error) {
    // A concurrent server startup may have created the administrator first.
    if (error.code === 11000 && await User.exists({ role: 'admin' })) return null;
    throw error;
  }

  console.warn('==========================================================');
  console.warn('No administrator account was found. A bootstrap admin was created.');
  console.warn(`Admin email: ${email}`);
  console.warn(`Temporary password: ${password}`);
  console.warn('Save this password securely and change it after signing in.');
  console.warn('This password is shown only once and cannot be recovered.');
  console.warn('==========================================================');
  return { email };
};

module.exports = { bootstrapAdminIfMissing };
