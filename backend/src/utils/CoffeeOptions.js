// Product-owned choices. Never accept prices or labels supplied by the customer.
const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
const validateOptionGroups = groups => {
  if (!Array.isArray(groups) || groups.length > 8) return false;
  const names = new Set();
  return groups.every(group => {
    if (!group || !validText(group.name) || names.has(group.name) || !Array.isArray(group.choices) || !group.choices.length || group.choices.length > 12 || (group.required !== undefined && typeof group.required !== 'boolean')) return false;
    names.add(group.name);
    const values = new Set();
    return group.choices.every(choice => {
      if (!choice || !validText(choice.label) || values.has(choice.label) || !Number.isFinite(choice.priceAdjustment ?? 0) || (choice.priceAdjustment ?? 0) < 0 || Math.abs(Math.round((choice.priceAdjustment ?? 0) * 100) - (choice.priceAdjustment ?? 0) * 100) > 0.000001) return false;
      values.add(choice.label); return true;
    });
  });
};
const resolveOptions = (product, selections = []) => {
  const groups = product.optionGroups || [];
  if (!Array.isArray(selections) || selections.length > 8) return { error: 'Invalid coffee options.' };
  const chosen = new Map();
  for (const selection of selections) {
    if (!selection || !validText(selection.name) || !validText(selection.value) || chosen.has(selection.name)) return { error: 'Invalid or duplicate coffee options.' };
    chosen.set(selection.name, selection.value);
  }
  if ([...chosen.keys()].some(name => !groups.some(group => group.name === name))) return { error: 'Unknown coffee option.' };
  const options = [];
  for (const group of groups) {
    const value = chosen.get(group.name);
    if (!value) { if (group.required) return { error: `Choose ${group.name}.` }; continue; }
    const choice = group.choices.find(choice => choice.label === value);
    if (!choice) return { error: `Invalid ${group.name}.` };
    options.push({ name: group.name, value: choice.label, priceAdjustment: choice.priceAdjustment || 0 });
  }
  const unitPrice = Math.round((product.price + options.reduce((sum, option) => sum + option.priceAdjustment, 0)) * 100) / 100;
  return { options, unitPrice };
};
module.exports = { validateOptionGroups, resolveOptions };
