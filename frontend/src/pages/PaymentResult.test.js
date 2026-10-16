import { shoppingStorage } from '../shoppingSession';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PaymentResult from './PaymentResult';
import { apiRequest } from '../api';
jest.mock('../api', () => ({ apiRequest: jest.fn() }));
jest.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams('order=ORD-TEST&status=success')], Link: ({to, children}) => <a href={to}>{children}</a> }));
const order = { _id:'test', orderNumber:'ORD-TEST', status:'pending', paymentMethod:'online', paymentStatus:'pending', grandTotal:100, products:[], paymentCheckoutUrl:'https://checkout.paymongo.com/test' };
beforeEach(() => { localStorage.clear(); localStorage.setItem('user_token','test'); apiRequest.mockReset(); });
test('success redirect alone never confirms payment and unpaid checkout can be resumed', async () => {
  apiRequest.mockResolvedValue({ok:true,data:{payload:[order]}});
  const { unmount } = render(<PaymentResult />);
  expect(await screen.findByRole('heading',{name:'Payment is awaiting confirmation'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Continue secure payment'})).toHaveAttribute('href',order.paymentCheckoutUrl);
  expect(screen.queryByRole('heading',{name:'Payment confirmed'})).not.toBeInTheDocument();
  unmount();
});
test('revisiting a paid order preserves a new shopping bag', async () => {
  shoppingStorage.setItem('cartItems','new bag');
  shoppingStorage.setItem('coffeePendingPaymentBag',JSON.stringify({orderNumber:'ORD-TEST',items:'old bag'}));
  apiRequest.mockResolvedValue({ok:true,data:{payload:[{...order,paymentStatus:'paid'}]}});
  render(<PaymentResult />);
  await screen.findByRole('heading',{name:'Payment confirmed'});
  expect(shoppingStorage.getItem('cartItems')).toBe('new bag');
  expect(shoppingStorage.getItem('coffeePendingPaymentBag')).toBeNull();
});
test('confirmed payment clears only the matching checkout bag', async () => {
  shoppingStorage.setItem('cartItems','checkout bag');
  shoppingStorage.setItem('coffeePendingPaymentBag',JSON.stringify({orderNumber:'ORD-TEST',items:'checkout bag'}));
  apiRequest.mockResolvedValue({ok:true,data:{payload:[{...order,paymentStatus:'paid'}]}});
  render(<PaymentResult />);
  await waitFor(() => expect(shoppingStorage.getItem('cartItems')).toBeNull());
});
