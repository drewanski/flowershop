import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationCenter, { notificationPath } from './NotificationCenter';
import { apiRequest } from '../api';
import { STORE_EVENT } from '../shoppingSession';
jest.mock('../api', () => ({apiRequest:jest.fn()}));
jest.mock('react-router-dom', () => ({MemoryRouter:({children})=>children,useNavigate:()=>jest.fn()}));
const item={_id:'notice1',order:'order1',orderNumber:'ORD-1',title:'Order being prepared',message:'ORD-1 is being prepared.',createdAt:'2026-10-16T00:00:00Z',readAt:null};
beforeEach(()=>{
  localStorage.clear();jest.clearAllMocks();
  apiRequest.mockResolvedValue({ok:true,data:{payload:{items:[item],unreadCount:1,nextCursor:null}}});
});
const signIn=()=>{localStorage.setItem('user_token','demo-token');localStorage.setItem('user_currentUser',JSON.stringify({_id:'customer1',role:'customer'}));};
test('signed-out visitors have no inbox and make no notification requests',()=>{
  render(<MemoryRouter><NotificationCenter/></MemoryRouter>);
  expect(screen.queryByRole('button',{name:/Notifications,/})).not.toBeInTheDocument();expect(apiRequest).not.toHaveBeenCalled();
});
test('unread inbox can mark a notification read and is removed on signout',async()=>{
  signIn();render(<MemoryRouter><NotificationCenter/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Notifications, 1 unread'}));
  expect(await screen.findByText('ORD-1 is being prepared.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Mark Order being prepared read'}));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/notifications/notice1/read',expect.objectContaining({method:'PATCH'})));
  act(()=>{localStorage.clear();window.dispatchEvent(new Event(STORE_EVENT));});
  expect(screen.queryByText('ORD-1 is being prepared.')).not.toBeInTheDocument();
});
test('mark-all submits the displayed boundary; opening inbox alone never marks read',async()=>{
  signIn();render(<MemoryRouter><NotificationCenter/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Notifications, 1 unread'}));
  expect(apiRequest.mock.calls.every(([,options])=>!options)).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:/Mark all read/}));
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/notifications/read-all',{method:'PATCH',body:JSON.stringify({through:'notice1'})}));
});
test('notification navigation follows customer, operations and rider permissions',()=>{
  expect(notificationPath({role:'customer'},item)).toBe('/loguser?order=order1#order-order1');
  expect(notificationPath({role:'admin'},item)).toBe('/adminpanel?order=ORD-1');
  expect(notificationPath({role:'delivery'},{...item,deliveryView:'available'})).toBe('/delivery?view=available&order=order1');
  expect(notificationPath({role:'delivery'},item)).toBe('/delivery?view=mine&order=order1');
});
