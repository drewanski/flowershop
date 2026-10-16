require('dotenv').config();
const mongoose=require('mongoose');
const crypto=require('crypto');
const assert=require('node:assert/strict');
const User=require('../src/models/User');
const Product=require('../src/models/Product');
const Order=require('../src/models/Order');
const EmployeeLog=require('../src/models/EmployeeLog');
const {encryptPassword}=require('../src/utils/AuthUtils');
const base=(process.env.API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/,'');
const tag=crypto.randomBytes(5).toString('hex');
const users=[];const products=[];const orderIds=[];
async function request(path,token,body,method=body?'POST':'GET',expected=true){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  assert.equal(response.ok,expected,`${path}: ${data.message}`);return data.payload;
}
async function run(){
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');
  try{
    const tokens={};
    for(const role of ['customer','crew','delivery']){
      const password=crypto.randomBytes(16).toString('hex');
      const user=await User.create({firstName:'Lifecycle',lastName:role,username:`lifecycle${role}${tag}`,email:`lifecycle-${role}-${tag}@example.com`,contactNumber:`09${crypto.randomInt(100000000,999999999)}`,role,password:await encryptPassword(password)});
      users.push(user);
      const login=await request('/auth/login',null,{email:user.email,password});tokens[role]=login.token;
    }
    const extra=await Product.create({sku:`LIFECYCLE-EXTRA-${tag}`,name:'Temporary oat extra',description:'Disposable lifecycle test',price:35,stock:8,isAddon:true,status:'available',image:'/images/products/oat-milk.webp',category:'Test',createdBy:users[1]._id,updatedBy:users[1]._id});products.push(extra);
    const coffee=await Product.create({sku:`LIFECYCLE-COFFEE-${tag}`,name:'Temporary lifecycle latte',description:'Disposable lifecycle test',price:150,stock:6,status:'available',image:'/images/products/latte.webp',category:'Test',type:'Latte',createdBy:users[1]._id,updatedBy:users[1]._id,optionGroups:[{name:'Size',required:true,choices:[{label:'Large',priceAdjustment:30}]}],allowedAddons:[{addon:extra._id,minQuantity:0,maxQuantity:2}]});products.push(coffee);
    const makeOrder=quantity=>({paymentMethod:'cash',notes:'Lifecycle preparation note',deliveryAddress:{latitude:14.6,longitude:121,street:'Test Street',barangay:'Test Barangay',city:'Test City',province:'Test Province'},products:[{product:String(coffee._id),quantity,options:[{name:'Size',value:'Large'}],addons:[{addon:String(extra._id),quantity:1}]}]});
    const order=await request('/orders',tokens.customer,makeOrder(2));orderIds.push(order._id);
    assert.equal(order.grandTotal,430);
    assert.equal((await Product.findById(coffee._id)).stock,4);
    assert.equal((await Product.findById(extra._id)).stock,6);
    assert.equal(order.products[0].options[0].value,'Large');
    await request(`/orders/${order._id}/status`,tokens.crew,{status:'ready'},'PATCH',false);
    await request(`/orders/${order._id}/payment`,tokens.crew,{paymentStatus:'paid',paymentAmount:500,paymentChange:70},'PATCH',false);
    for(const status of ['confirmed','queued','ready'])await request(`/orders/${order._id}/status`,tokens.crew,{status},'PATCH');
    const available=await request('/orders/delivery/available',tokens.delivery);
    assert(available.some(item=>String(item._id)===String(order._id)));
    for(const action of ['claim','ship','deliver'])await request(`/orders/delivery/${order._id}/${action}`,tokens.delivery,{});
    await request(`/orders/${order._id}/payment`,tokens.crew,{paymentStatus:'paid',paymentAmount:500,paymentChange:0},'PATCH',false);
    await request(`/orders/${order._id}/payment`,tokens.crew,{paymentStatus:'paid',paymentAmount:500,paymentChange:70},'PATCH');
    await request(`/orders/${order._id}/payment`,tokens.crew,{paymentStatus:'paid',paymentAmount:500,paymentChange:70},'PATCH',false);
    const history=await request('/orders/mine',tokens.customer);
    const completed=history.find(item=>String(item._id)===String(order._id));
    assert.equal(completed.status,'delivered');assert.equal(completed.paymentStatus,'paid');assert.equal(completed.paymentChange,70);
    const cancelled=await request('/orders',tokens.customer,makeOrder(1));orderIds.push(cancelled._id);
    const cancellations=await Promise.all([1,2].map(()=>fetch(base+`/orders/mine/${cancelled._id}/cancel`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens.customer}`},body:JSON.stringify({reason:'Lifecycle concurrent cancellation test'})})));
    assert.equal(cancellations.filter(response=>response.ok).length,1,'Only one concurrent cancellation may succeed');
    await request(`/orders/mine/${cancelled._id}/cancel`,tokens.customer,{reason:'Repeat cancellation'},'POST',false);
    assert.equal((await Product.findById(coffee._id)).stock,4);
    assert.equal((await Product.findById(extra._id)).stock,6);
    await request('/orders',tokens.customer,makeOrder(99),'POST',false);
    console.log('PASS: configured pricing, stock reservation, stage guards, crew preparation, rider claim/dispatch/delivery, cash amount/change validation, duplicate collection rejection, customer history, cancellation and stock restoration, overselling rejection.');
  }finally{
    if(users[0])await Order.deleteMany({user:users[0]._id});
    await Product.deleteMany({_id:{$in:products.map(product=>product._id)}});
    await EmployeeLog.deleteMany({email:{$in:users.map(user=>user.email)}});
    await User.deleteMany({_id:{$in:users.map(user=>user._id)}});
    await mongoose.disconnect();console.log('Temporary lifecycle records removed.');
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
