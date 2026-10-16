const express = require('express');
const AdminController = require('../controllers/AdminController');
const { requireToken, requireManagement } = require('../middlewares/AuthMiddleware');

const router = express.Router();
router.use(requireToken, requireManagement);
router.post('/users', AdminController.createUser);
router.get('/customers', AdminController.listCustomers);
router.patch('/customers/:id', AdminController.updateCustomer);
router.delete('/customers/:id', AdminController.deleteCustomer);
router.get('/employee-logs', AdminController.listEmployeeLogs);

module.exports = router;