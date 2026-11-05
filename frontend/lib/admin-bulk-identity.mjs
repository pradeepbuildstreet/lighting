export const BULK_IDENTITY_LIMIT = 100;
export function mergeIdentitySelection(current, incoming) {
  const rows = [...new Map([...current, ...incoming].map(p => [p.id, p])).values()];
  if (rows.length > BULK_IDENTITY_LIMIT) throw Error('Select at most 100 products per batch.');
  return rows;
}
export function namingFingerprint(s) {
  return JSON.stringify([s.name, s.rule_scope, s.category_id, s.selected_primary_category_id, s.settings_revision]);
}
export function identityBody(p, name, assignMissingSku) {
  if (!String(name || '').trim() || String(name).trim().length > 255) throw Error('Enter a product name of 1–255 characters.');
  if (!p.attributes?.product_kind_id || !p.attributes.kind_active) throw Error('An active tag-model product kind is required.');
  if (!/^[1-9]\d*$/.test(String(p.revision))) throw Error('Reload the product revision.');
  const fields = ['sku', 'brand', 'model_number', 'description', 'selling_price', 'currency', 'is_active', 'category_ids', 'primary_category_id'];
  const product = Object.fromEntries(fields.map(k => [k, p[k]]));
  product.name = String(name).trim();
  product.product_kind_id = p.attributes.product_kind_id;
  product.tag_ids = p.tags.map(t => t.id);
  product.tag_mode = 'replace';
  product.attributes = Object.fromEntries(['light_source_mode', 'length_mm', 'breadth_mm', 'height_mm', 'wattage', 'lumens'].map(k => [k, p.attributes[k] ?? null]));
  return {product, expected_revision: String(p.revision), assign_sku: !!assignMissingSku && !p.sku};
}
export function makeIdentityPreview(p, suggestion, replaceNames, assignMissingSku) {
  const protectedName = !!String(p.name || '').trim() && !replaceNames;
  const name = protectedName ? p.name : suggestion.name;
  const body = identityBody(p, name, assignMissingSku);
  const changes = body.product.name !== (p.name || '') || body.assign_sku;
  return {id: p.id, product: p, suggestion, name, protectedName, include: changes, status: changes ? 'Ready for review' : 'No changes needed', error: ''};
}
export function verifyIdentitySnapshot(preview, current, suggestion) {
  if (current.id !== preview.id || String(current.revision) !== String(preview.product.revision) || current.sku !== preview.product.sku) throw Error('Product changed since preview. Generate a fresh preview.');
  if (namingFingerprint(suggestion) !== namingFingerprint(preview.suggestion)) throw Error('Naming output or rule changed. Generate a fresh preview.');
}
