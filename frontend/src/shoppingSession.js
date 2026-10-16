export const STORE_EVENT = 'coffee-store-change';
const keys = ['cartItems', 'wishlistItems', 'checkoutAddress', 'coffeeOrderNotes', 'coffeePaymentMethod', 'coffeeSelectedVouchers', 'coffeePendingPaymentBag'];
const customerScope = user => `customer:${user._id || user.id || user.email}`;
export const getShoppingScope = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
    if (localStorage.getItem('user_token') && user) return user.role === 'customer' && (user._id || user.id || user.email) ? customerScope(user) : 'staff';
  } catch {}
  return 'guest';
};
const scopedKey = (scope, key) => `coffee:${scope}:${key}`;
// Old shared browser data has no reliable owner when signed out. Retain it privately,
// rather than showing it to the next guest or assigning it to the next account.
export const migrateShoppingData = () => {
  const scope = getShoppingScope();
  const owner = scope.startsWith('customer:') ? scope : 'legacy-unassigned';
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      if (localStorage.getItem(scopedKey(owner, key)) === null) localStorage.setItem(scopedKey(owner, key), value);
      localStorage.removeItem(key);
    }
  }
};
export const notifyShoppingChange = () => window.dispatchEvent(new Event(STORE_EVENT));
export const shoppingStorage = {
  getItem(key) { migrateShoppingData(); const scope = getShoppingScope(); return scope === 'staff' ? null : localStorage.getItem(scopedKey(scope, key)); },
  setItem(key, value) { migrateShoppingData(); const scope = getShoppingScope(); if (scope !== 'staff') localStorage.setItem(scopedKey(scope, key), value); },
  removeItem(key) { migrateShoppingData(); const scope = getShoppingScope(); if (scope !== 'staff') localStorage.removeItem(scopedKey(scope, key)); },
};
const list = value => { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
const identity = item => JSON.stringify([item._id, (item.options || []).map(option => [option.name, option.value]).sort(), (item.addons || []).map(extra => [extra._id || extra.addon, extra.quantity]).sort()]);
export const saveSession = (user, token) => {
  migrateShoppingData();
  if (user.role === 'customer') {
    const scope = customerScope(user);
    const guestCart = list(localStorage.getItem(scopedKey('guest', 'cartItems')));
    const merged = list(localStorage.getItem(scopedKey(scope, 'cartItems')));
    for (const item of guestCart) {
      const existing = merged.find(saved => identity(saved) === identity(item));
      if (existing) existing.quantity = Number(existing.quantity) + Number(item.quantity);
      else merged.push(item);
    }
    if (guestCart.length) {
      localStorage.setItem(scopedKey(scope, 'cartItems'), JSON.stringify(merged));
      for (const key of ['checkoutAddress', 'coffeeOrderNotes', 'coffeePaymentMethod']) {
        const value = localStorage.getItem(scopedKey('guest', key));
        if (value !== null && localStorage.getItem(scopedKey(scope, key)) === null) localStorage.setItem(scopedKey(scope, key), value);
      }
    }
    const favorites = [...list(localStorage.getItem(scopedKey(scope, 'wishlistItems'))), ...list(localStorage.getItem(scopedKey('guest', 'wishlistItems')))];
    localStorage.setItem(scopedKey(scope, 'wishlistItems'), JSON.stringify(favorites.filter((item, index) => favorites.findIndex(other => other._id === item._id) === index)));
    for (const key of keys) localStorage.removeItem(scopedKey('guest', key));
  }
  localStorage.setItem('user_token', token);
  localStorage.setItem('user_currentUser', JSON.stringify(user));
  localStorage.setItem('user_isLoggedIn', 'true');
  localStorage.setItem('userType', user.role);
  localStorage.setItem('userEmail', user.email || '');
  notifyShoppingChange();
};
export const clearSession = () => {
  migrateShoppingData();
  ['user_token', 'user_currentUser', 'user_isLoggedIn', 'userType', 'userEmail', 'currentUserEmail', 'currentUserType'].forEach(key => localStorage.removeItem(key));
  notifyShoppingChange();
};
