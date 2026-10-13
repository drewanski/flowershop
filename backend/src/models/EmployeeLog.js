const mongoose = require('mongoose');

const employeeLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  role: {
    type: String,
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('EmployeeLog', employeeLogSchema);