import { clearStaffSession } from './staffSession';

test('staff logout removes authentication while preserving shopping and checkout data', () => {
  localStorage.clear();
  localStorage.setItem('user_token', 'old-token');
  localStorage.setItem('user_currentUser', '{"role":"admin"}');
  localStorage.setItem('user_isLoggedIn', 'true');
  localStorage.setItem('userType', 'admin');
  localStorage.setItem('userEmail', 'staff@example.com');
  localStorage.setItem('cart', '[{"quantity":2}]');
  localStorage.setItem('deliveryDraft', '{"street":"Test Street"}');
  clearStaffSession();
  expect(localStorage.getItem('user_token')).toBeNull();
  expect(localStorage.getItem('user_currentUser')).toBeNull();
  expect(localStorage.getItem('user_isLoggedIn')).toBeNull();
  expect(localStorage.getItem('userType')).toBeNull();
  expect(localStorage.getItem('userEmail')).toBeNull();
  expect(localStorage.getItem('cart')).toBe('[{"quantity":2}]');
  expect(localStorage.getItem('deliveryDraft')).toBe('{"street":"Test Street"}');
  localStorage.clear();
});
