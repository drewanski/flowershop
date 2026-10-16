require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const User = require('../src/models/User');
const catalog = require('./coffee-catalog');
async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');
  const owner = await User.findOne({ role: { $in: ['admin', 'manager'] } }).select('_id');
  if (!owner) throw new Error('Create an admin or manager account before seeding the catalog.');
  // Insert only: reruns preserve staff edits, stock, and pricing.
  for (const product of catalog) await Product.updateOne({ sku: product.sku }, { $setOnInsert: { ...product, allowedAddons: [], createdBy: owner._id, updatedBy: owner._id } }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  for (const product of catalog.filter(item => item.optionGroups)) await Product.updateOne({ sku: product.sku, 'optionGroups.0': { $exists: false } }, { $set: { optionGroups: product.optionGroups } }, { runValidators: true });
  // Upgrade only bundled placeholder images; preserve staff-uploaded photos.
  for (const product of catalog) await Product.updateOne({ sku: product.sku, image: { $regex: '^/images/(latte|americano|mocha|vanilla|cold-brew|beans)\\.svg$' } }, { $set: { image: product.image } }, { runValidators: true });
  const addons = await Product.find({ sku: { $in: ['ADDON-SHOT-001', 'ADDON-OAT-001'] } }).select('_id');
  await Product.updateMany({ sku: { $in: ['COFFEE-LATTE-001', 'COFFEE-AMERICANO-001', 'COFFEE-MOCHA-001', 'COFFEE-VANILLA-001', 'COFFEE-COLD-001'] }, allowedAddons: { $size: 0 } }, { $set: { allowedAddons: addons.map(addon => ({ addon: addon._id, minQuantity: 0, maxQuantity: 2 })) } }, { runValidators: true });
  if (process.argv.includes('--migrate-legacy')) {
    // Phase out only known sample SKUs. Keep IDs and records for order history.
    const legacy = ['TEST-FLOWER-001','TEST-FLOWER-002','TEST-FLOWER-003','TEST-FLOWER-004','BLOOM-PINK-ROSES-001','BLOOM-RED-ROSES-001','BLOOM-WHITE-ROSES-001','BLOOM-TULIPS-001'];
    const result = await Product.updateMany({ sku: { $in: legacy } }, { $set: { status: 'phased_out', updatedBy: owner._id } });
    console.log(`Phased out ${result.modifiedCount} legacy sample products; order history retained.`);
  }
  console.log('Coffee catalog ready: six products and two optional add-ons. Existing catalog edits preserved.');
}
seed().catch(error => { console.error(`Unable to prepare coffee catalog: ${error.message}`); process.exitCode = 1; }).finally(async () => { if (mongoose.connection.readyState) await mongoose.disconnect(); });
