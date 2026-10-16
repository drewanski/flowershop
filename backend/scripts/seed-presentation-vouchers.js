require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const VoucherTemplate = require('../src/models/VoucherTemplate');
const VoucherService = require('../src/services/VoucherService');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');
  try {
    const admin = await User.findOne({ role: 'admin', isDisabled: { $ne: true } });
    if (!admin) throw new Error('An enabled admin account is required.');
    const latte = await Product.findOne({ sku: 'COFFEE-LATTE-001', status: 'available' });
    const beans = await Product.findOne({ sku: 'COFFEE-BEANS-001', status: 'available' });
    if (!latte || !beans) throw new Error('House Latte and House Blend must be available.');
    const offers = [
      {code:'KAPE10',name:'Everyday coffee savings',discountType:'percentage',discountValue:10,minOrderValue:150,maxDiscountValue:75},
      {code:'SIP50',name:'Share a coffee break',discountType:'fixed',discountValue:50,minOrderValue:250,maxDiscountValue:50},
      {code:'LATTE20',name:'A little latte love',discountType:'percentage',discountValue:20,minOrderValue:150,maxDiscountValue:60,allowedProducts:[{product:latte._id,minQuantity:1,addons:[]}]},
      {code:'BEANS75',name:'Bring your ritual home',discountType:'fixed',discountValue:75,minOrderValue:350,maxDiscountValue:75,allowedProducts:[{product:beans._id,minQuantity:1,addons:[]}]},
      {code:'FIRSTCUP25',name:'Your first coffee with us',discountType:'fixed',discountValue:25,minOrderValue:100,maxDiscountValue:25,newCustomersOnly:true},
      {code:'DEMOFREE',name:'Presentation: complimentary coffee',discountType:'percentage',discountValue:100,minOrderValue:100,maxDiscountValue:150},
    ];
    const startDate = new Date(Date.now() - 60000);
    const endDate = new Date(Date.now() + 90 * 86400000);
    for (const offer of offers) {
      if (await VoucherTemplate.exists({'voucher.code':offer.code})) { console.log(`${offer.code}: already exists; preserved.`); continue; }
      const result = await VoucherService.createVoucher({voucher:{allowedProducts:[],newCustomersOnly:false,description:`Presentation offer: ${offer.name}.`,termsAndConditions:'Presentation/testing campaign. One claim per customer. Minimum spend and maximum savings apply. Product restrictions apply where specified.',...offer},startDate,endDate,usageLimitPublic:100,usageLimitPerUser:1},admin._id);
      if (result.code !== require('../src/responses/VoucherResponses').codes.success.code) throw new Error(`${offer.code}: ${result.message}`);
      console.log(`${offer.code}: created.`);
    }
  } finally { await mongoose.disconnect(); }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
