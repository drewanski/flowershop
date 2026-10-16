const { validateOptionGroups, resolveOptions } = require('../utils/CoffeeOptions');
jest.mock('../models/Product', () => ({ find: jest.fn() }));
const Product = require('../models/Product');
const OrderService = require('../services/OrderService');
const id = '507f1f77bcf86cd799439011';
const groups = [{ name: 'Size', required: true, choices: [{label:'Regular',priceAdjustment:0},{label:'Large',priceAdjustment:30}] }, { name:'Temperature', required:true, choices:[{label:'Hot',priceAdjustment:0},{label:'Iced',priceAdjustment:0}] }];
const product = { _id:id, name:'House Latte', price:150, status:'available', isAddon:false, allowedAddons:[], optionGroups:groups };
const choices = [{name:'Size',value:'Large'},{name:'Temperature',value:'Iced'}];
test('validates unique configuration and rejects malformed prices',()=>{
  expect(validateOptionGroups(groups)).toBe(true);
  expect(validateOptionGroups([...groups,groups[0]])).toBe(false);
  expect(validateOptionGroups([{name:'Size',choices:[{label:'Large',priceAdjustment:-1}]}])).toBe(false);
  expect(validateOptionGroups([{name:'Size',choices:[{label:'Large',priceAdjustment:0.29}]}])).toBe(true);
  expect(validateOptionGroups([{name:'Size',choices:[{label:'Large',priceAdjustment:0.299}]}])).toBe(false);
});
test('requires configured choices and rejects unknown and duplicate selections',()=>{
  expect(resolveOptions(product,[]).error).toMatch(/Size/);
  expect(resolveOptions(product,[...choices,{name:'Milk',value:'Oat'}]).error).toMatch(/Unknown/);
  expect(resolveOptions(product,[...choices,choices[0]]).error).toMatch(/duplicate/);
  expect(resolveOptions(product,[{name:'Size',value:'Free giant cup'},choices[1]]).error).toMatch(/Size/);
  expect(resolveOptions({price:110},[])).toEqual({options:[],unitPrice:110});
});
test('uses catalog price adjustments instead of forged customer prices',()=>{
  const result=resolveOptions(product,choices.map(option=>({...option,priceAdjustment:-150})));
  expect(result.unitPrice).toBe(180);
  expect(result.options[0]).toEqual({name:'Size',value:'Large',priceAdjustment:30});
});
test('the order preview charges configured choices for every item and rejects incomplete carts',async()=>{
  Product.find.mockResolvedValue([product]);
  const valid=await OrderService.previewVoucherApplication({products:[{product:id,quantity:2,options:choices,price:1}],voucherIds:[]},id);
  expect(valid.code).toBe(300);
  expect(valid.payload).toMatchObject({subtotal:360,total:360,discount:0});
  const invalid=await OrderService.previewVoucherApplication({products:[{product:id,quantity:1,options:[choices[0]]}],voucherIds:[]},id);
  expect(invalid.code).not.toBe(300);
});

test('malformed cart lines return validation errors without crashing', async()=>{
  for (const products of [[null], [{product:id,quantity:1,addons:{}}], [{product:id,quantity:1,addons:[null]}]]) {
    const result=await OrderService.previewVoucherApplication({products,voucherIds:[]},id);
    expect(result.code).not.toBe(300);
  }
});
