require('dotenv').config({quiet:true});
const crypto=require('node:crypto');
const mongoose=require('mongoose');
const assert=require('node:assert/strict');
const User=require('../src/models/User');
const Product=require('../src/models/Product');
const Order=require('../src/models/Order');
const Instance=require('../src/models/VoucherInstance');
const Template=require('../src/models/VoucherTemplate');
const Counter=require('../src/models/VoucherClaimCounter');
const {encryptPassword,generateJWT}=require('../src/utils/AuthUtils');
const base='http://localhost:5000/api';
let customer;
async function request(path,token,body,expected=true){
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();assert.equal(response.ok,expected,`${path}: ${data.message}`);return data.payload;
}
async function run(){
  await mongoose.connect(process.env.MONGODB_URI||'mongodb://localhost:27017/coffeeshop');
  try{
    const tag=crypto.randomBytes(5).toString('hex');
    customer=await User.create({firstName:'Voucher',lastName:'Test',username:'vouchertest'+tag,email:`voucher-${tag}@example.com`,contactNumber:`09${crypto.randomInt(100000000,999999999)}`,password:await encryptPassword(crypto.randomBytes(16).toString('hex')),role:'customer'});
    const token=generateJWT(customer);
    const latte=await Product.findOne({sku:'COFFEE-LATTE-001'});
    const beans=await Product.findOne({sku:'COFFEE-BEANS-001'});
    const item=(product,quantity=1)=>({product:String(product._id),quantity,options:product.optionGroups.map(group=>({name:group.name,value:group.choices[0].label}))});
    const cases=[['KAPE10',latte,1,15],['SIP50',latte,2,50],['LATTE20',latte,1,30],['BEANS75',beans,1,75],['FIRSTCUP25',latte,1,25],['DEMOFREE',latte,1,150]];
    const claimed={};
    for(const [code,product,quantity,discount] of cases){
      const instance=await request('/vouchers/claim',token,{code});claimed[code]=instance._id;
      const preview=await request('/vouchers/customer/preview',token,{products:[item(product,quantity)],voucherIds:[instance._id]});
      assert.equal(preview.discount,discount);console.log(`PASS ${code}: discount PHP ${discount}, total PHP ${preview.total}`);
    }
    await request('/vouchers/claim',token,{code:'KAPE10'},false);
    await request('/vouchers/claim',token,{code:'NO-SUCH-DEMO'},false);
    await request('/vouchers/customer/preview',token,{products:[item(latte)],voucherIds:[claimed.SIP50]},false);
    await request('/vouchers/customer/preview',token,{products:[item(beans)],voucherIds:[claimed.LATTE20]},false);
    const stacked=await request('/vouchers/customer/preview',token,{products:[item(latte,2)],voucherIds:[claimed.KAPE10,claimed.SIP50]});
    assert.equal(stacked.discount,80);assert.equal(stacked.total,220);
    const order=await request('/orders',token,{paymentMethod:'online',notes:'TEMPORARY VOUCHER TEST',products:[item(latte)],voucherIds:[claimed.DEMOFREE],deliveryAddress:{latitude:14.6,longitude:121,street:'Test Street',barangay:'Test',city:'Manila',province:'Metro Manila'}});
    assert.equal(order.grandTotal,0);assert.equal(order.paymentStatus,'paid');assert.equal(order.paymentMethodProvider,'voucher');assert(!order.paymentCheckoutUrl);
    await request('/vouchers/customer/preview',token,{products:[item(latte)],voucherIds:[claimed.DEMOFREE]},false);
    await request('/vouchers/customer/preview',token,{products:[item(latte)],voucherIds:[claimed.FIRSTCUP25]},false);
    console.log('PASS: minimum spend, wrong-product rejection, duplicate claim, invalid code, stacking, fully covered online checkout without PayMongo charge, used-voucher rejection, first-order restriction.');
  }finally{
    if(customer){
      const orders=await Order.find({user:customer._id});
      for(const order of orders)for(const line of order.products)await Product.updateOne({_id:line.product},{$inc:{stock:line.quantity}});
      const instances=await Instance.find({owner:customer._id});
      for(const instance of instances)await Template.updateOne({_id:instance.template,usageCountPublic:{$gt:0}},{$inc:{usageCountPublic:-1}});
      await Order.deleteMany({user:customer._id});await Instance.deleteMany({owner:customer._id});await Counter.deleteMany({owner:customer._id});await User.deleteOne({_id:customer._id});
      console.log('Temporary customer, claims, and order removed; test stock and claim counts restored. Presentation vouchers remain available.');
    }
    await mongoose.disconnect();
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
