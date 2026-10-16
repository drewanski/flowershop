import { shoppingStorage, saveSession, clearSession, getShoppingScope } from './shoppingSession';
const alice={_id:'alice',role:'customer',email:'alice@example.com'};
const bob={_id:'bob',role:'customer',email:'bob@example.com'};
const coffee={_id:'latte',quantity:1,options:[{name:'Size',value:'Large'}],addons:[]};
const bag=()=>JSON.parse(shoppingStorage.getItem('cartItems')||'[]');
beforeEach(()=>localStorage.clear());
test('customer logout hides their bag and address, and sign-in restores them',()=>{
  saveSession(alice,'token'); shoppingStorage.setItem('cartItems',JSON.stringify([coffee])); shoppingStorage.setItem('checkoutAddress','private address');
  clearSession(); expect(bag()).toEqual([]); expect(shoppingStorage.getItem('checkoutAddress')).toBeNull();
  saveSession(alice,'token'); expect(bag()).toEqual([coffee]); expect(shoppingStorage.getItem('checkoutAddress')).toBe('private address');
});
test('different customers never inherit each others checkout data',()=>{
  saveSession(alice,'token'); shoppingStorage.setItem('cartItems',JSON.stringify([coffee])); shoppingStorage.setItem('coffeePendingPaymentBag','private payment');
  clearSession(); saveSession(bob,'token'); expect(bag()).toEqual([]); expect(shoppingStorage.getItem('coffeePendingPaymentBag')).toBeNull();
});
test('guest quantities merge once while different configurations stay separate',()=>{
  saveSession(alice,'token'); shoppingStorage.setItem('cartItems',JSON.stringify([{...coffee,quantity:2}])); clearSession();
  shoppingStorage.setItem('cartItems',JSON.stringify([coffee,{...coffee,options:[{name:'Size',value:'Regular'}]}]));
  shoppingStorage.setItem('checkoutAddress','guest drop-off'); saveSession(alice,'token');
  expect(bag()).toHaveLength(2); expect(bag()[0].quantity).toBe(3); expect(shoppingStorage.getItem('checkoutAddress')).toBe('guest drop-off');
  clearSession(); expect(bag()).toEqual([]); saveSession(alice,'token'); expect(bag()[0].quantity).toBe(3);
});
test('staff cannot read or modify customer or guest shopping bags',()=>{
  shoppingStorage.setItem('cartItems',JSON.stringify([coffee])); saveSession({_id:'rider',role:'delivery'},'token');
  expect(getShoppingScope()).toBe('staff'); expect(bag()).toEqual([]); shoppingStorage.setItem('cartItems','[]');
  clearSession(); expect(bag()).toEqual([coffee]);
});
test('legacy shared data with no owner is retained privately and not assigned to the next user',()=>{
  localStorage.setItem('cartItems',JSON.stringify([coffee])); expect(bag()).toEqual([]);
  expect(localStorage.getItem('coffee:legacy-unassigned:cartItems')).not.toBeNull();
  saveSession(bob,'token'); expect(bag()).toEqual([]);
});
test('legacy cart belonging to the currently signed-in customer is preserved on logout',()=>{
  localStorage.setItem('user_currentUser',JSON.stringify(alice)); localStorage.setItem('user_token','token');localStorage.setItem('cartItems',JSON.stringify([coffee]));
  clearSession(); expect(bag()).toEqual([]); saveSession(alice,'token'); expect(bag()).toEqual([coffee]);
});
