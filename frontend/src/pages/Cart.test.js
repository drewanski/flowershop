import { shoppingStorage } from '../shoppingSession';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Cart from './Cart';
import { apiRequest } from '../api';
jest.mock('../api',()=>({apiRequest:jest.fn()}));
jest.mock('../components/StoreHeader',()=>()=> <header>Coffee House</header>);
jest.mock('../components/DeliveryMap',()=>()=> <div>Delivery map</div>);
let mockPath='/cart';
const mockNavigate=jest.fn();
jest.mock('react-router-dom',()=>({useNavigate:()=>mockNavigate,useLocation:()=>({pathname:mockPath}),Link:({to,children,...props})=><a href={to} {...props}>{children}</a>}));
beforeEach(()=>{
  localStorage.clear();apiRequest.mockReset();mockNavigate.mockReset();mockPath='/cart';
  localStorage.setItem('user_token','test-token');
  localStorage.setItem('user_currentUser',JSON.stringify({_id:'customer1',role:'customer'}));
  shoppingStorage.setItem('checkoutAddress',JSON.stringify({latitude:14,longitude:121,street:'Test Street',barangay:'Test Barangay',city:'Test City',province:'Test Province',riderInstructions:'Test gate'}));
  shoppingStorage.setItem('cartItems',JSON.stringify([{_id:'coffee1',name:'Latte',price:1,quantity:2,addons:[],options:[{name:'Size',value:'Large'}]}]));
  apiRequest.mockImplementation(async path=>({ok:true,data:{payload:path==='/products/coffee1'?{_id:'coffee1',name:'Latte',price:150,stock:10,status:'available',allowedAddons:[],optionGroups:[{name:'Size',required:true,choices:[{label:'Large',priceAdjustment:30}]}]}:path==='/payments/methods'?['cash']:[]}}));
});
test('the cart advances to a separate checkout without creating an order',async()=>{
  shoppingStorage.removeItem('checkoutAddress');
  render(<Cart />);
  expect(screen.queryByRole('textbox',{name:'Delivery address'})).not.toBeInTheDocument();
  expect(screen.queryByText('Delivery map')).not.toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('button',{name:/Continue to checkout/})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:/Continue to checkout/}));
  expect(mockNavigate).toHaveBeenCalledWith('/checkout');
  expect(screen.queryByRole('button',{name:'Place order'})).not.toBeInTheDocument();
  expect(apiRequest.mock.calls.some(([path])=>path==='/orders')).toBe(false);
});
test('checkout shows delivery, validated totals and payment before explicit submission',async()=>{
  mockPath='/checkout'; render(<Cart />);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
  expect(screen.getByRole('region',{name:'Review your order'})).toHaveTextContent('Size: Large');
  expect(screen.getByRole('complementary',{name:'Order summary'})).toHaveTextContent('Test gate');
  expect(screen.getByRole('radio',{name:/Cash on delivery/})).toBeChecked();
  expect(screen.getByRole('complementary',{name:'Order summary'})).toHaveTextContent('360');
  expect(screen.getByRole('textbox',{name:'Delivery address'})).toBeInTheDocument();
  expect(apiRequest.mock.calls.some(([path])=>path==='/orders')).toBe(false);
});
test('selecting a checkout address pins coordinates and fills address details',async()=>{
  mockPath='/checkout';
  const implementation=apiRequest.getMockImplementation();
  apiRequest.mockImplementation(async(path,options)=>{
    if(path==='/locations/geocode')return {ok:true,data:{payload:[{label:'Test Cafe, Test City',latitude:14.1,longitude:121.1}]}};
    if(path==='/locations/reverse')return {ok:true,data:{payload:{street:'New Street',barangay:'New Barangay',city:'New City',province:'New Province',formattedAddress:'New Street, New City'}}};
    return implementation(path,options);
  });
  render(<Cart/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Delivery address'}),{target:{value:'Test Cafe, Test City'}});
  fireEvent.click(screen.getByRole('button',{name:'Search',exact:true}));
  fireEvent.click(await screen.findByRole('button',{name:'Test Cafe, Test City'}));
  await screen.findByText('Delivery point selected');
  await waitFor(()=>expect(JSON.parse(shoppingStorage.getItem('checkoutAddress'))).toMatchObject({latitude:'14.100000',longitude:'121.100000',street:'New Street',city:'New City'}));
});


test('guest must sign in before checkout and the guest bag stays saved',async()=>{
  localStorage.removeItem('user_token'); localStorage.removeItem('user_currentUser');
  shoppingStorage.setItem('cartItems',JSON.stringify([{_id:'coffee1',name:'Latte',quantity:1,options:[{name:'Size',value:'Large'}],addons:[]}]));
  render(<Cart/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:/Continue to checkout/})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:/Continue to checkout/}));
  expect(mockNavigate).toHaveBeenCalledWith('/login',{state:{from:'/checkout'}});
  expect(JSON.parse(shoppingStorage.getItem('cartItems'))).toHaveLength(1);
  expect(apiRequest.mock.calls.some(([path])=>path==='/orders')).toBe(false);
});
