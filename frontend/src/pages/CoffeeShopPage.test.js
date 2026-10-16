import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CoffeeShopPage from './CoffeeShopPage';
import { apiRequest } from '../api';
jest.mock('../api', () => ({ apiRequest: jest.fn() }));
jest.mock('react-router-dom', () => { const params = new URLSearchParams(); return { useSearchParams: () => [params], Link: ({to,children,...props}) => <a href={to} {...props}>{children}</a> }; });
jest.mock('../components/StoreHeader', () => () => <header>Coffee House</header>);
const catalog = [
  { _id: '1', name: 'Americano', category: 'Signature Coffee', type: 'Black Coffee', price: 110 },
  { _id: '2', name: 'House Latte', category: 'Signature Coffee', type: 'Espresso & Milk', price: 150 },
  { _id: '3', name: 'House Blend', category: 'Coffee Beans', type: 'Whole Bean', price: 350 },
];
beforeEach(() => { apiRequest.mockResolvedValue({ ok: true, data: { payload: catalog } }); });
test('loads the real catalog and filters coffee prices at the inclusive boundary', async () => {
  render(<CoffeeShopPage />);
  await screen.findByText('House Latte');
  expect(apiRequest).toHaveBeenCalledWith('/products?status=available&isAddon=false');
  fireEvent.change(screen.getByLabelText('Filter by price'), { target: { value: 'Medium' } });
  expect(screen.getByText('House Latte')).toBeInTheDocument();
  expect(screen.queryByText('Americano')).not.toBeInTheDocument();
  expect(screen.queryByText('House Blend')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter by price'), { target: { value: 'High' } });
  expect(screen.getByText('House Blend')).toBeInTheDocument();
});
test('shows API failures without substituting a fake catalog', async () => {
  apiRequest.mockResolvedValue({ ok: false, data: { message: 'Catalog unavailable' } });
  render(<CoffeeShopPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable');
  expect(screen.queryByText('House Latte')).not.toBeInTheDocument();
});
