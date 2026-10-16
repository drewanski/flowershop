import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import { apiRequest } from '../api';
import { signInWithPopup } from 'firebase/auth';
jest.mock('../api', () => ({ apiRequest: jest.fn() }));
jest.mock('../components/StoreHeader', () => () => <header>Coffee House</header>);
jest.mock('../firebase/firebase', () => ({ auth: {}, provider: {} }));
jest.mock('firebase/auth', () => ({ signInWithPopup: jest.fn() }));
const mockNavigate = jest.fn();
let mockFrom;
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => ({state:{from:mockFrom}}), Link: ({to,children}) => <a href={to}>{children}</a> }));
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); mockFrom=undefined; });
const response = role => ({ok:true,data:{payload:{user:{role,email:'test@example.com'},token:'verified-token'}}});
async function submit() {
  fireEvent.change(screen.getByLabelText('Email, username, or phone number'),{target:{value:'test@example.com'}});
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'TestPassword123'}});
  fireEvent.click(screen.getByRole('button',{name:'Log In',exact:true}));
}
test.each([['customer','/userinfo'],['admin','/adminpanel'],['manager','/adminpanel'],['crew','/adminpanel'],['delivery','/delivery']])('shared login sends %s to %s',async(role,path)=>{
  apiRequest.mockResolvedValue(response(role)); render(<Login/>); await submit();
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith(path,{replace:true}));
  expect(JSON.parse(localStorage.getItem('user_currentUser')).role).toBe(role);
});
test('customers return to their saved checkout after login',async()=>{
  mockFrom='/checkout'; apiRequest.mockResolvedValue(response('customer')); render(<Login/>); await submit();
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith('/checkout',{replace:true}));
});
test('a rider arriving from customer checkout still goes to delivery',async()=>{
  mockFrom='/checkout'; apiRequest.mockResolvedValue(response('delivery')); render(<Login/>); await submit();
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith('/delivery',{replace:true}));
});
test('customer cannot be redirected into admin or an external site',async()=>{
  mockFrom='/adminpanel'; apiRequest.mockResolvedValue(response('customer')); render(<Login/>); await submit();
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith('/userinfo',{replace:true}));
});
test('unknown roles are rejected without storing their token',async()=>{
  apiRequest.mockResolvedValue(response('unknown')); render(<Login/>); await submit();
  expect(await screen.findByText(/does not have a supported role/)).toBeInTheDocument();
  expect(localStorage.getItem('user_token')).toBeNull(); expect(mockNavigate).not.toHaveBeenCalled();
});
test('Google login uses the backend account role for crew',async()=>{
  signInWithPopup.mockResolvedValue({user:{email:'test@example.com',getIdToken:async()=> 'google-token'}});
  apiRequest.mockResolvedValue(response('crew')); render(<Login/>);
  fireEvent.click(screen.getByRole('button',{name:'Google Login'}));
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith('/adminpanel',{replace:true}));
});
