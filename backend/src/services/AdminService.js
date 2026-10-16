const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeLog = require('../models/EmployeeLog');
const { isValidPhoneNumber, isValidEmail } = require('../utils/UserUtils');
const { encryptPassword } = require('../utils/AuthUtils');
const { USER_ROLES } = require('../constants/UserConstants');


const createUser = async (creator, data = {}) => {
  const role = typeof data.role === 'string' ? data.role.trim().toLowerCase() : '';
  const allowedRoles = creator?.role === USER_ROLES.ADMIN
    ? Object.values(USER_ROLES)
    : [USER_ROLES.CREW, USER_ROLES.DELIVERY];

  if (!allowedRoles.includes(role)) {
    return { status: 403, message: creator?.role === USER_ROLES.ADMIN
      ? 'Unsupported user role.'
      : 'Managers may only create crew and delivery users.' };
  }

  const firstName = typeof data.firstName === 'string' ? data.firstName.trim() : '';
  const middleName = typeof data.middleName === 'string' ? data.middleName.trim() : '';
  const lastName = typeof data.lastName === 'string' ? data.lastName.trim() : '';
  const contactNumber = typeof data.contactNumber === 'string' ? data.contactNumber.trim() : '';
  const username = typeof data.username === 'string' ? data.username.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const password = data.password;

  const missing = [];
  if (!firstName) missing.push('firstName');
  if (!lastName) missing.push('lastName');
  if (!contactNumber) missing.push('contactNumber');
  if (!username) missing.push('username');
  if (!email) missing.push('email');
  if (!password) missing.push('password');
  if (missing.length) return { status: 400, payload: { missingFields: missing }, message: 'Required fields are missing.' };

  if (!isValidPhoneNumber(contactNumber) || !isValidEmail(email)
    || typeof password !== 'string' || password.length < 8
    || username.length < 3 || username.length > 30
    || firstName.length > 50 || lastName.length > 50
    || (middleName && middleName.length > 50)
    || (typeof data.homeAddress === 'string' && data.homeAddress.length > 500)) {
    return { status: 400, message: 'Invalid user data. Check the email, contact number, name, username, address, and password (at least 8 characters).' };
  }

  try {
    const existing = await User.findOne({
      $or: [{ email }, { username }, { contactNumber }],
    }).select('_id');
    if (existing) return { status: 409, message: 'Email, username, or contact number is already in use.' };

    const user = await User.create({
      firstName,
      ...(middleName ? { middleName } : {}),
      lastName,
      contactNumber,
      ...(typeof data.homeAddress === 'string' && data.homeAddress.trim()
        ? { homeAddress: data.homeAddress.trim() } : {}),
      username,
      email,
      password: await encryptPassword(password),
      role,
    });
    user.password = undefined;
    return { status: 201, payload: user, message: 'User created successfully.' };
  } catch (error) {
    if (error.code === 11000) return { status: 409, message: 'Email, username, or contact number is already in use.' };
    throw error;
  }
};

const listCustomers = async () => User.find({ role: 'customer' })
  .select('-password')
  .sort({ createdAt: -1 });

const updateCustomer = async (id, data) => {
  if (!mongoose.isValidObjectId(id)) return { status: 400, message: 'Invalid customer ID.' };

  const allowed = ['firstName', 'lastName', 'contactNumber', 'homeAddress', 'isDisabled'];
  const updates = Object.fromEntries(
    Object.entries(data || {}).filter(([key]) => allowed.includes(key))
  );

  if (!Object.keys(updates).length) return { status: 400, message: 'No supported fields were provided.' };
  if (updates.firstName !== undefined && !String(updates.firstName).trim()) {
    return { status: 400, message: 'First name cannot be empty.' };
  }
  if (updates.lastName !== undefined && !String(updates.lastName).trim()) {
    return { status: 400, message: 'Last name cannot be empty.' };
  }
  if (updates.homeAddress !== undefined && String(updates.homeAddress).length > 500) {
    return { status: 400, message: 'Address cannot exceed 500 characters.' };
  }
  if (updates.contactNumber !== undefined && !isValidPhoneNumber(String(updates.contactNumber).trim())) {
    return { status: 400, message: 'Enter a valid contact number.' };
  }

  const customer = await User.findOneAndUpdate(
    { _id: id, role: 'customer' },
    updates,
    { new: true, runValidators: true }
  ).select('-password');

  return customer
    ? { status: 200, payload: customer, message: 'Customer updated.' }
    : { status: 404, message: 'Customer not found.' };
};

const deleteCustomer = async (id) => {
  if (!mongoose.isValidObjectId(id)) return { status: 400, message: 'Invalid customer ID.' };

  const result = await User.deleteOne({ _id: id, role: 'customer' });
  return result.deletedCount
    ? { status: 200, message: 'Customer deleted.' }
    : { status: 404, message: 'Customer not found.' };
};

const listEmployeeLogs = async () => EmployeeLog.find()
  .select('-__v')
  .sort({ createdAt: -1 })
  .limit(500);

module.exports = { createUser, listCustomers, updateCustomer, deleteCustomer, listEmployeeLogs };