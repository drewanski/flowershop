const AdminService = require('../services/AdminService');

const send = (res, result) => res.status(result.status || 200).json({
  ...(result.payload !== undefined ? { payload: result.payload } : {}),
  message: result.message || 'Success.',
});

const listCustomers = async (req, res) => send(res, {
  payload: await AdminService.listCustomers(),
  message: 'Customers loaded.',
});

const updateCustomer = async (req, res) => send(
  res,
  await AdminService.updateCustomer(req.params.id, req.body)
);

const deleteCustomer = async (req, res) => send(
  res,
  await AdminService.deleteCustomer(req.params.id)
);

const listEmployeeLogs = async (req, res) => send(res, {
  payload: await AdminService.listEmployeeLogs(),
  message: 'Employee logs loaded.',
});

module.exports = { listCustomers, updateCustomer, deleteCustomer, listEmployeeLogs };