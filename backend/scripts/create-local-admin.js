require('dotenv').config();

const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { encryptPassword } = require('../src/utils/AuthUtils');

const email = 'admin@coffeeshop.local';

const createAdmin = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error(`${email} already exists. No account was changed.`);
  }

  const password = crypto.randomBytes(24).toString('base64url');
  const suffix = crypto.randomBytes(5).toString('hex');
  const contactNumber = `0917${String(1000000 + crypto.randomInt(0, 8999999))}`;

  await User.create({
    firstName: 'Local',
    lastName: 'Administrator',
    contactNumber,
    username: `localadmin${suffix}`,
    email,
    password: await encryptPassword(password),
    role: 'admin',
  });

  console.log(`Admin email: ${email}`);
  console.log(`Temporary password: ${password}`);
  console.log('Store this password securely; it will not be shown again.');
};

createAdmin()
  .catch((error) => {
    console.error(`Unable to create local admin: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });