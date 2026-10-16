const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  eventKey: { type: String, required: true },
  kind: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: String,
  deliveryView: { type: String, enum: ['available', 'mine'] },
  readAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ recipient: 1, role: 1, createdAt: -1 });
schema.index({ recipient: 1, role: 1, readAt: 1 });
schema.index({ recipient: 1, eventKey: 1 }, { unique: true });
module.exports = mongoose.model('Notification', schema);
