import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AdminCatalog, AdminCustomers, AdminEmployeeLogs } from './AdminDataViews';
import AddonRulesEditor from './AddonRulesEditor';
const product={_id:'latte',name:'House Latte',sku:'LATTE-1',price:150,stock:10,status:'available',category:'Coffee',image:'/images/products/latte.webp',isAddon:false};
test('catalog starts with current menu, and retired entries remain searchable through filters',()=>{
  render(<AdminCatalog products={[product,{...product,_id:'old',name:'Retired flower',status:'phased_out'}]} draft={{}} setDraft={jest.fn()} onCreate={jest.fn()} />);
  expect(screen.getByText('House Latte')).toBeInTheDocument();
  expect(screen.queryByText('Retired flower')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Product filter'),{target:{value:'retired'}});
  expect(screen.getByText('Retired flower')).toBeInTheDocument();
  expect(screen.queryByText('House Latte')).not.toBeInTheDocument();
});
test('product form is opt-in and has accessible fields without exposing raw JSON',()=>{
  render(<AdminCatalog products={[product]} draft={{isAddon:false,optionGroups:[]}} setDraft={jest.fn()} onCreate={jest.fn()} />);
  expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Add product'}));
  expect(screen.getByLabelText('Product name')).toBeRequired();
  expect(screen.getByLabelText('Price (PHP)')).toHaveAttribute('type','number');
  expect(screen.queryByLabelText(/JSON/)).not.toBeInTheDocument();
});
test('customer edit opens a labeled inline form instead of browser prompts',()=>{
  render(<AdminCustomers customers={[{_id:'c',firstName:'Demo',lastName:'Customer',email:'demo@example.com',contactNumber:'09999999999'}]} onUpdate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'Edit'}));
  expect(screen.getByLabelText('First name')).toHaveValue('Demo');
  expect(screen.getByLabelText('Phone number')).toHaveValue('09999999999');
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
});
test('activity pagination and role filtering keep large logs manageable',()=>{
  const logs=Array.from({length:12},(_,i)=>({_id:`log${i}`,email:`staff${i}@example.com`,role:i===11?'delivery':'admin',createdAt:'2026-10-16T00:00:00Z'}));
  render(<AdminEmployeeLogs logs={logs}/>);
  expect(screen.queryByText('staff11@example.com')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByText('staff11@example.com')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Employee role filter'),{target:{value:'delivery'}});
  expect(screen.getByText('staff11@example.com')).toBeInTheDocument();
  expect(screen.queryByText('staff10@example.com')).not.toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByText('Rider')).toBeInTheDocument();
});
test('extra editor serializes the same backend rule format',()=>{
  const change=jest.fn();
  const {rerender}=render(<AddonRulesEditor value="[]" products={[{...product,_id:'oat',name:'Oat milk',isAddon:true}]} onChange={change}/>);
  fireEvent.click(screen.getByRole('button',{name:'+ Add an extra'}));
  expect(JSON.parse(change.mock.calls[0][0])).toEqual([{addon:'',minQuantity:0,maxQuantity:2}]);
  rerender(<AddonRulesEditor value={change.mock.calls[0][0]} products={[{...product,_id:'oat',name:'Oat milk',isAddon:true}]} onChange={change}/>);
  fireEvent.change(screen.getByLabelText('Extra'),{target:{value:'oat'}});
  expect(JSON.parse(change.mock.calls[1][0])).toEqual([{addon:'oat',minQuantity:0,maxQuantity:2}]);
});
