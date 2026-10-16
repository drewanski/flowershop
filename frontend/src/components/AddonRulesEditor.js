import React from 'react';

export default function AddonRulesEditor({ value = '[]', products, onChange }) {
  let rules;
  try { rules = JSON.parse(value); } catch { rules = []; }
  const extras = products.filter(product => product.isAddon && product.status !== 'phased_out');
  const update = (index, changes) => onChange(JSON.stringify(rules.map((rule, i) => i === index ? { ...rule, ...changes } : rule)));
  return <fieldset className="coffee-admin-options addon-rules-editor"><legend>Available extras</legend><p>Choose which extras customers can add. Quantities apply to each coffee.</p>
    {rules.map((rule, index) => <div className="addon-rule-row" key={index}>
      <label>Extra<select required value={rule.addon?._id || rule.addon || ''} onChange={e => update(index, { addon: e.target.value })}><option value="">Choose an extra</option>{extras.map(extra => <option key={extra._id} value={extra._id} disabled={rules.some((r, i) => i !== index && String(r.addon?._id || r.addon) === extra._id)}>{extra.name}</option>)}</select></label>
      <label>Minimum<input type="number" required min="0" max={rule.maxQuantity || 0} step="1" value={rule.minQuantity ?? 0} onChange={e => update(index, { minQuantity: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
      <label>Maximum<input type="number" required min={rule.minQuantity || 0} step="1" value={rule.maxQuantity ?? 2} onChange={e => update(index, { maxQuantity: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
      <button type="button" className="admin-danger-text" onClick={() => onChange(JSON.stringify(rules.filter((_, i) => i !== index)))}>Remove</button>
    </div>)}
    {!rules.length && <div className="admin-inline-empty">No extras selected. This product will be sold on its own.</div>}
    <button className="admin-secondary" type="button" disabled={rules.length >= extras.length} onClick={() => onChange(JSON.stringify([...rules, { addon: '', minQuantity: 0, maxQuantity: 2 }]))}>+ Add an extra</button>
    {!extras.length && <small>Create an add-on product first to make it available here.</small>}
  </fieldset>;
}
