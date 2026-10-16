import { shoppingStorage } from './shoppingSession';
export { STORE_EVENT } from './shoppingSession';
import { STORE_EVENT } from './shoppingSession';
export const readList = key => { try { const value = JSON.parse(shoppingStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
export const writeList = (key, value) => { shoppingStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event(STORE_EVENT)); };
export const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
export const optionText = options => (options || []).map(option => `${option.name}: ${option.value}`).join(' / ');
