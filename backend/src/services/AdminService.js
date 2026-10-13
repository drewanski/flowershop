const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeLog = require('../models/EmployeeLog');
const { isValidPhoneNumber } = require('../utils/UserUtils');

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

module.exports = { listCustomers, updateCustomer, deleteCustomer, listEmployeeLogs };