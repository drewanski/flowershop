jest.mock('../models/Notification', () => ({find:jest.fn(),countDocuments:jest.fn(),findOneAndUpdate:jest.fn(),updateMany:jest.fn()}));
jest.mock('../middlewares/AuthMiddleware', () => ({requireToken:(req,res,next)=>{
  if(!req.headers.authorization)return res.status(401).json({message:'Sign in required'});
  req.user={_id:'507f1f77bcf86cd799439011',role:'customer'};next();
}}));
const express=require('express');
const Notification=require('../models/Notification');
let server,base;
beforeAll(async()=>{
  const app=express();app.use(express.json());app.use('/notifications',require('../routes/NotificationRoutes'));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});
  base=`http://127.0.0.1:${server.address().port}/notifications`;
});
afterAll(()=>new Promise(resolve=>server.close(resolve)));
beforeEach(()=>{
  jest.clearAllMocks();
  Notification.find.mockReturnValue({sort:()=>({limit:()=>({select:()=>({lean:async()=>[]})})})});
  Notification.countDocuments.mockResolvedValue(0);
});
test('signed-out requests are rejected',async()=>{expect((await fetch(base)).status).toBe(401);expect(Notification.find).not.toHaveBeenCalled();});
test('list and unread count are scoped to authenticated recipient AND role',async()=>{
  expect((await fetch(base,{headers:{authorization:'Bearer test'}})).status).toBe(200);
  expect(Notification.find).toHaveBeenCalledWith({recipient:'507f1f77bcf86cd799439011',role:'customer'});
  expect(Notification.countDocuments).toHaveBeenCalledWith({recipient:'507f1f77bcf86cd799439011',role:'customer',readAt:null});
});
test('cannot mark a different account notification read',async()=>{
  Notification.findOneAndUpdate.mockResolvedValue(null);
  const response=await fetch(`${base}/507f1f77bcf86cd799439012/read`,{method:'PATCH',headers:{authorization:'Bearer test'}});
  expect(response.status).toBe(404);
  expect(Notification.findOneAndUpdate.mock.calls[0][0]).toEqual({recipient:'507f1f77bcf86cd799439011',role:'customer',_id:'507f1f77bcf86cd799439012'});
});
test('mark-all respects the displayed snapshot and never includes later arrivals',async()=>{
  const through='507f1f77bcf86cd799439012';
  const response=await fetch(`${base}/read-all`,{method:'PATCH',headers:{authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({through})});
  expect(response.status).toBe(200);
  expect(Notification.updateMany.mock.calls[0][0]).toEqual({recipient:'507f1f77bcf86cd799439011',role:'customer',readAt:null,_id:{$lte:through}});
});
