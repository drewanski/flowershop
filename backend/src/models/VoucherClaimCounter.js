const mongoose = require('mongoose');

const voucherClaimCounterSchema = new mongoose.Schema({
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'VoucherTemplate', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  claimCount: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

voucherClaimCounterSchema.index({ template: 1, owner: 1 }, { unique: true });
voucherClaimCounterSchema.index({ template: 1 });

module.exports = mongoose.model('VoucherClaimCounter', voucherClaimCounterSchema);
