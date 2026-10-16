// Disposable local integration test. Does not charge a payment or dispatch a real order.
require('dotenv').config();
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Notification = require('../src/models/Notification');
const { generateJWT, encryptPassword } = require('../src/utils/AuthUtils');
const { notifyOrder } = require('../src/services/NotificationService');
const base = process.env.SMOKE_API_URL || 'http://localhost:5000/api';
const suffix = crypto.randomBytes(4).toString('hex');
const fixtures = [], accounts = {};
let product, order;
async function request(role, path, method = 'GET', body, status = 200) {
  const response = await fetch(`${base}${path}`, {method, headers:{'Content-Type':'application/json', ...(role ? {Authorization:`Bearer ${generateJWT(accounts[role])}`} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
  const data = await response.json();
  assert.equal(response.status,status,`${method} ${path}: ${data.message}`);
  return data.payload;
}
async function inbox(role) {return request(role,'/notifications');}
(async()=>{
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeeshop');
    await Notification.init();
    const password = await encryptPassword(crypto.randomBytes(18).toString('hex'));
    for(const [index,role] of ['customer','other','admin','manager','crew','delivery','rider2'].entries()) {
      const user=await User.create({firstName:'Notification Test',lastName:role,username:`notify${suffix}${index}`,email:`notify-${suffix}-${index}@example.com`,contactNumber:`09${String(Date.now()+index).slice(-9)}`,password,role:role==='other'?'customer':role==='rider2'?'delivery':role});
      accounts[role]=user;fixtures.push(user._id);
    }
    product=await Product.create({sku:`NOTIFY-${suffix}`,name:'NOTIFICATION TEST ONLY',description:'Disposable test product; do not prepare.',price:100,image:'/images/products/latte.webp',category:'Test',status:'available',stock:10,isAddon:false,createdBy:accounts.admin._id});
    await request(null,'/notifications','GET',undefined,401);
    order=await request('customer','/orders','POST',{products:[{product:product._id,quantity:1,options:[],addons:[]}],paymentMethod:'cash',notes:'NOTIFICATION INTEGRATION TEST ONLY — no physical preparation or delivery.',deliveryAddress:{latitude:14.5995,longitude:120.9842,street:'Test Street',barangay:'Test',city:'Manila',province:'Metro Manila'}});
    assert.equal((await inbox('customer')).unreadCount,1);
    for(const role of ['admin','manager','crew'])assert.equal((await inbox(role)).items[0].order,String(order._id));
    assert.equal((await inbox('delivery')).unreadCount,0);
    assert.equal((await inbox('other')).items.length,0);
    const customerNotice=(await inbox('customer')).items[0];
    await request('other',`/notifications/${customerNotice._id}/read`,'PATCH',{},404);
    for(const status of ['confirmed','queued','ready'])await request('admin',`/orders/${order._id}/status`,'PATCH',{status});
    assert.equal((await inbox('customer')).items[0].kind,'status:ready');
    assert.equal((await inbox('delivery')).items[0].deliveryView,'available');
    assert.equal((await inbox('rider2')).items[0].kind,'status:ready');
    await request('delivery',`/orders/delivery/${order._id}/claim`,'POST',{});
    assert.equal((await inbox('customer')).items[0].kind,'status:claimed');
    assert.equal((await inbox('delivery')).items[0].deliveryView,'mine');
    assert.equal((await inbox('rider2')).items.length,1);
    await request('delivery',`/orders/delivery/${order._id}/ship`,'POST',{});
    await request('delivery',`/orders/delivery/${order._id}/deliver`,'POST',{});
    await request('admin',`/orders/${order._id}/payment`,'PATCH',{paymentStatus:'paid',paymentAmount:100,paymentChange:0});
    const paid=await Order.findById(order._id);
    const before=await Notification.countDocuments({order:order._id});
    await notifyOrder(paid,'payment:paid'); await notifyOrder(paid,'payment:paid');
    assert.equal(await Notification.countDocuments({order:order._id}),before);
    const page=await inbox('customer');
    assert.equal(page.items[0].kind,'payment:paid');
    await request('customer','/notifications/read-all','PATCH',{through:page.items[0]._id});
    assert.equal((await inbox('customer')).unreadCount,0);
    assert.ok((await inbox('admin')).unreadCount>0);
    // A separate cancelled order exercises cancellation alerts and stock restoration.
    const cancelled=await request('customer','/orders','POST',{products:[{product:product._id,quantity:1,options:[],addons:[]}],paymentMethod:'cash'});
    try {
      await request('customer',`/orders/mine/${cancelled._id}/cancel`,'POST',{reason:'Disposable notification test finished.'});
      assert.equal((await inbox('customer')).items[0].kind,'status:cancelled');
      assert.equal((await inbox('admin')).items[0].kind,'status:cancelled');
    } finally {await Notification.deleteMany({order:cancelled._id});await Order.deleteOne({_id:cancelled._id});}
    console.log('PASS: customer/admin/manager/crew/rider notifications, ownership, unread state, status lifecycle, payment deduplication and cancellation.');
  } finally {
    if(order){await Notification.deleteMany({order:order._id});await Order.deleteOne({_id:order._id});}
    if(product)await Product.deleteOne({_id:product._id});
    if(fixtures.length){await Notification.deleteMany({recipient:{$in:fixtures}});await User.deleteMany({_id:{$in:fixtures}});}
    await mongoose.disconnect();
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
