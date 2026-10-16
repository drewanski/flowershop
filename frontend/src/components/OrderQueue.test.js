import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import OrderQueue from './OrderQueue';
import OrderProgress from './OrderProgress';
import {summarizeOrders} from '../orderWorkflow';
const order={_id:'1',orderNumber:'ORD-TEST',createdAt:'2026-10-16T02:00:00Z',status:'pending',paymentMethod:'cash',paymentStatus:'pending',grandTotal:150,products:[{productName:'House Latte',quantity:1,options:[{name:'Size',value:'Large'}]}],user:{firstName:'Test',lastName:'Customer',contactNumber:'09171234567'},deliveryAddress:{street:'Test Street',city:'Test City'}};
test('staff see coffee choices and an actionable stage while unpaid online orders are blocked',()=>{
  render(<OrderQueue orders={[{...order,paymentMethod:'online'}]} onRefresh={jest.fn()} onStatus={jest.fn()} onPayment={jest.fn()}/>);
  expect(screen.getByText('Size: Large')).toBeInTheDocument();
  expect(screen.getByText('09171234567')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Accept order'})).toBeDisabled();
  expect(screen.getByText(/Wait for confirmed payment/)).toBeInTheDocument();
});
test('staff cancellation requires a reason and submits only after confirmation',async()=>{
  const update=jest.fn().mockResolvedValue(undefined);
  render(<OrderQueue orders={[order]} onRefresh={jest.fn()} onStatus={update} onPayment={jest.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Cancel order'}));
  expect(screen.getByRole('button',{name:'Confirm cancellation'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason for cancellation'),{target:{value:'Machine unavailable'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirm cancellation'}));
  await waitFor(()=>expect(update).toHaveBeenCalledWith(order,'cancelled','Machine unavailable'));
});
test('cash collection calculates change and keeps underpayments disabled',async()=>{
  const payment=jest.fn().mockResolvedValue(undefined);
  render(<OrderQueue orders={[{...order,status:'delivered'}]} onRefresh={jest.fn()} onStatus={jest.fn()} onPayment={payment}/>);
  fireEvent.click(screen.getByRole('button',{name:'1 delivered order needs cash collection recorded'}));
  fireEvent.click(screen.getByRole('button',{name:'Record cash received'}));
  fireEvent.change(screen.getByLabelText('Cash received (PHP)'),{target:{value:'100'}});
  expect(screen.getByRole('button',{name:'Confirm cash collected'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Cash received (PHP)'),{target:{value:'200'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirm cash collected'}));
  await waitFor(()=>expect(payment).toHaveBeenCalledWith(expect.objectContaining({status:'delivered'}),200,50));
});
test('customer tracking explains preparation and marks the current stage',()=>{
  render(<OrderProgress order={{...order,status:'queued',queuedAt:'2026-10-16T02:10:00Z'}}/>);
  expect(screen.getByText('The team is preparing your coffee.')).toBeInTheDocument();
  expect(screen.getByText('Preparing').closest('li')).toHaveAttribute('aria-current','step');
  expect(screen.getByText('Cash due on delivery')).toBeInTheDocument();
});
test('collected dashboard revenue excludes unpaid and cancelled orders',()=>{
  expect(summarizeOrders([order,{...order,_id:'2',paymentStatus:'paid',paidAt:order.createdAt,status:'delivered'},{...order,_id:'3',paymentStatus:'paid',status:'cancelled',paidAt:order.createdAt}],new Date('2026-10-16T10:00:00Z'))).toEqual({today:3,active:1,collected:150});
});
