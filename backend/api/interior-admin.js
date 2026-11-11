'use strict';
const crypto = require('node:crypto');
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function id(value) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail(400, 'Invalid UUID'); return value.toLowerCase(); }
function text(value, max, required = false) { if (typeof value !== 'string' || value.length > max || required && !value.trim()) fail(400, 'Invalid text field'); return value.trim(); }
function integer(value, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, 'Invalid integer'); return value; }
function bool(value) { if (typeof value !== 'boolean') fail(400, 'Boolean required'); return value; }
function slug(value) { const s = text(value, 200, true); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) fail(400, 'Use a lowercase hyphenated slug'); return s; }
const definitions = {
 projects: { table: 'interior_projects', fields: ['name','slug','developer_name','locality','city','description','relationship','published','sort_order'] },
 layouts: { table: 'interior_layouts', parent: 'project_id', parentTable: 'interior_projects', fields: ['name','slug','property_type','area_sqft','notes','floor_plan_public','published','sort_order'] },
 designs: { table: 'interior_designs', parent: 'layout_id', parentTable: 'interior_layouts', fields: ['name','slug','description','published','sort_order'] }
};
function validate(kind, body, updating = false) {
 const def = definitions[kind]; if (!def || !body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid record');
 const allowed = new Set([...def.fields, ...(def.parent ? [def.parent] : []), ...(updating ? ['revision'] : [])]);
 if (Object.keys(body).some(k => !allowed.has(k))) fail(400, 'Unknown field');
 const result = { name: text(body.name, 200, true), slug: slug(body.slug), published: bool(body.published), sort_order: integer(body.sort_order, 0, 100000) };
 if (updating) result.revision = String(integer(Number(body.revision), 1, Number.MAX_SAFE_INTEGER));
 if (def.parent) result[def.parent] = id(body[def.parent]);
 if (kind === 'projects') { for (const k of ['developer_name','locality']) result[k] = text(body[k], 200); result.city = text(body.city, 120); if (!['independent','authorized'].includes(body.relationship)) fail(400, 'Invalid relationship'); result.relationship = body.relationship; }
 if (kind !== 'layouts') result.description = text(body.description, 20000);
 if (kind === 'layouts') {
  if (!['2bhk','3bhk','villa'].includes(body.property_type)) fail(400, 'Invalid property type');
  result.property_type = body.property_type; result.notes = text(body.notes, 10000); result.floor_plan_public = bool(body.floor_plan_public);
  if (body.area_sqft == null || body.area_sqft === '') result.area_sqft = null;
  else { if (!['number','string'].includes(typeof body.area_sqft) || !/^\d{1,10}(\.\d{1,2})?$/.test(String(body.area_sqft)) || Number(body.area_sqft) <= 0) fail(400, 'Invalid area'); result.area_sqft = String(body.area_sqft); }
 }
 return result;
}
function products(value) {
 if (!Array.isArray(value) || value.length > 500) fail(400, 'Select at most 500 products'); const seen = new Set();
 return value.map((p, i) => { if (!p || typeof p !== 'object' || Object.keys(p).some(k => !['product_id','quantity','room_labels','selected_by_default'].includes(k))) fail(400, 'Invalid product selection'); const key = id(p.product_id); if (seen.has(key)) fail(400, 'Duplicate product'); seen.add(key); if (!Array.isArray(p.room_labels) || p.room_labels.length > 50) fail(400, 'Invalid room labels'); return { product_id: key, quantity: integer(p.quantity, 1, 10000), room_labels: [...new Set(p.room_labels.map(r => text(r, 120, true)))], selected_by_default: bool(p.selected_by_default), sort_order: i }; });
}
function imageType(buffer) {
 if (!Buffer.isBuffer(buffer)) fail(400, 'Image required');
 if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
 if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
 if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
 fail(400, 'Only JPEG, PNG and WebP images are supported');
}
function createRouter({ express, db, requireAdmin, upload }) {
 const router = express.Router(); router.use(requireAdmin); router.use((_req, res, next) => { res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); next(); });
 const route = fn => async (req, res) => { try { await fn(req, res); } catch (e) { console.error('[interior-admin]', e.code || e.status || 'ERROR'); const status = e.status || (e.code === '23505' ? 409 : e.code === '23503' ? 409 : 503); res.status(status).json({ error: e.status ? e.message : status === 409 ? 'Record conflicts with existing data. Reload before retrying.' : 'Interior administration unavailable. Check saved state before retrying.' }); } };
 async function audit(c, actor, action, kind, key, before, after) { await c.query('INSERT INTO interior_admin_audit(actor_id,action,entity_type,entity_id,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6)', [actor.id, action, kind, key, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)]); }
 async function locked(c, kind, key, revision) { const def = definitions[kind]; const row = (await c.query(`SELECT * FROM ${def.table} WHERE id=$1 FOR UPDATE`, [id(key)])).rows[0]; if (!row) fail(404, 'Record not found'); if (String(row.revision) !== String(revision)) fail(409, 'Record changed. Reload before saving.'); return row; }
 async function bump(c, kind, key) { return (await c.query(`UPDATE ${definitions[kind].table} SET revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`, [key])).rows[0]; }
 router.get('/products', route(async (req, res) => { const q = text(req.query.q || '', 120); if (q.length < 2) return res.json({ products: [] }); const pattern = '%' + q.replace(/[\\%_]/g, '\\$&') + '%'; const result = await db.query("SELECT id,sku,name,selling_price,default_discount_percent,currency,is_active,published,review_status FROM products WHERE name ILIKE $1 OR sku ILIKE $1 ORDER BY name,id LIMIT 50", [pattern]); res.json({ products: result.rows }); }));
 for (const [kind, def] of Object.entries(definitions)) {
  router.get('/' + kind, route(async (req, res) => { const parent = def.parent ? id(req.query[def.parent]) : null; const result = await db.query(`SELECT * FROM ${def.table}${def.parent ? ' WHERE ' + def.parent + '=$1' : ''} ORDER BY sort_order,name,id LIMIT 1000`, parent ? [parent] : []); res.json({ records: result.rows }); }));
  router.get('/' + kind + '/:id', route(async (req, res) => { const row = (await db.query(`SELECT * FROM ${def.table} WHERE id=$1`, [id(req.params.id)])).rows[0]; if (!row) fail(404, 'Record not found'); res.json({ record: row }); }));
  for (const updating of [false, true]) router[updating ? 'put' : 'post']('/' + kind + (updating ? '/:id' : ''), route(async (req, res) => {
   const data = validate(kind, req.body, updating); const key = updating ? id(req.params.id) : crypto.randomUUID();
   const record = await db.transaction(async c => { const actor = await db.actor(c, req.admin); const before = updating ? await locked(c, kind, key, data.revision) : null;
    if (before && def.parent && before[def.parent] !== data[def.parent]) fail(400, 'Moving an existing record to another parent is not supported');
    if (def.parent && !(await c.query(`SELECT id FROM ${def.parentTable} WHERE id=$1 FOR KEY SHARE`, [data[def.parent]])).rows.length) fail(400, 'Parent record not found');
    if (kind === 'designs' && data.published) { const cover = await c.query('SELECT id FROM interior_images WHERE design_id=$1 AND is_cover', [key]); const members = await c.query('SELECT product_id FROM interior_design_products WHERE design_id=$1 LIMIT 1', [key]); if (!cover.rows.length || !members.rows.length) fail(400, 'Save a draft, upload a cover render and select products before publishing'); }
    const columns = [...def.fields, ...(def.parent ? [def.parent] : [])]; let row;
    if (updating) row = (await c.query(`UPDATE ${def.table} SET ${columns.map((k, i) => k + '=$' + (i + 2)).join(',')},revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`, [key, ...columns.map(k => data[k])])).rows[0];
    else row = (await c.query(`INSERT INTO ${def.table}(id,${columns.join(',')}) VALUES(${[key, ...columns].map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, [key, ...columns.map(k => data[k])])).rows[0];
    await audit(c, actor, updating ? 'update' : 'create', kind, key, before, row); return row;
   }); res.status(updating ? 200 : 201).json({ record });
  }));
 }
 router.get('/designs/:id/products', route(async (req, res) => { const result = await db.query('SELECT dp.*,p.sku,p.name,p.selling_price,p.default_discount_percent,p.is_active,p.published,p.review_status FROM interior_design_products dp JOIN products p ON p.id=dp.product_id WHERE dp.design_id=$1 ORDER BY dp.sort_order,p.id', [id(req.params.id)]); res.json({ products: result.rows }); }));
 router.put('/designs/:id/products', route(async (req, res) => { const key = id(req.params.id); const selected = products(req.body.products); const record = await db.transaction(async c => { const actor = await db.actor(c, req.admin); const design = await locked(c, 'designs', key, req.body.revision); if (design.published && !selected.length) fail(400, 'Unpublish before removing all products'); const before = (await c.query('SELECT * FROM interior_design_products WHERE design_id=$1 ORDER BY sort_order', [key])).rows; const keys = selected.map(p => p.product_id); if (keys.length && (await c.query('SELECT id FROM products WHERE id=ANY($1::uuid[]) FOR KEY SHARE', [keys])).rows.length !== keys.length) fail(400, 'Product not found'); await c.query('DELETE FROM interior_design_products WHERE design_id=$1 AND NOT(product_id=ANY($2::uuid[]))', [key, keys]); for (const p of selected) await c.query('INSERT INTO interior_design_products(design_id,product_id,quantity,room_labels,selected_by_default,sort_order) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(design_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity,room_labels=EXCLUDED.room_labels,selected_by_default=EXCLUDED.selected_by_default,sort_order=EXCLUDED.sort_order', [key,p.product_id,p.quantity,p.room_labels,p.selected_by_default,p.sort_order]); await audit(c, actor, 'replace_products', 'designs', key, before, selected); return bump(c, 'designs', key); }); res.json({ record, products: selected }); }));
 router.get('/:kind/:id/images', route(async (req, res) => { const kind = req.params.kind; if (!['layouts','designs'].includes(kind)) fail(404, 'Not found'); const result = await db.query(`SELECT id,kind,caption,room_label,is_cover,sort_order,revision,content_type FROM interior_images WHERE ${kind === 'layouts' ? 'layout_id' : 'design_id'}=$1 ORDER BY sort_order,id`, [id(req.params.id)]); res.json({ images: result.rows }); }));
 router.get('/images/:id/file', route(async (req, res) => { const row = (await db.query('SELECT content_type,image_data FROM interior_images WHERE id=$1', [id(req.params.id)])).rows[0]; if (!row) fail(404, 'Image not found'); res.type(row.content_type).send(row.image_data); }));
 router.post('/:kind/:id/images', upload.single('image'), route(async (req, res) => {
  const kind = req.params.kind; if (!['layouts','designs'].includes(kind)) fail(404, 'Not found'); const key = id(req.params.id); const file = req.file; if (!file || !file.buffer.length || file.buffer.length > 10485760) fail(400, 'Image must be between 1 byte and 10 MiB'); const contentType = imageType(file.buffer); if (file.mimetype !== contentType) fail(400, 'Image content does not match its declared type');
  const caption = text(req.body.caption || '', 1000); const room = text(req.body.room_label || '', 120); if (!['true','false',undefined].includes(req.body.is_cover)) fail(400, 'Invalid cover flag'); const cover = kind === 'designs' && req.body.is_cover === 'true';
  let linked; try { linked = JSON.parse(req.body.product_ids || '[]'); } catch (_) { fail(400, 'Invalid product IDs'); } if (!Array.isArray(linked) || linked.length > 500) fail(400, 'Invalid product IDs'); linked = [...new Set(linked.map(id))]; if (kind === 'layouts' && linked.length) fail(400, 'Floor plans cannot link products');
  const receipt = await db.transaction(async c => { const actor = await db.actor(c, req.admin); await locked(c, kind, key, req.body.revision); const column = kind === 'layouts' ? 'layout_id' : 'design_id'; const count = Number((await c.query(`SELECT count(*) AS n FROM interior_images WHERE ${column}=$1`, [key])).rows[0].n); if (count >= (kind === 'layouts' ? 1 : 30)) fail(400, 'Image limit reached'); if (linked.length && (await c.query('SELECT product_id FROM interior_design_products WHERE design_id=$1 AND product_id=ANY($2::uuid[])', [key, linked])).rows.length !== linked.length) fail(400, 'Image products must belong to this design'); if (cover) await c.query('UPDATE interior_images SET is_cover=false,revision=gen_random_uuid() WHERE design_id=$1 AND is_cover', [key]); const image = (await c.query(`INSERT INTO interior_images(${column},kind,content_type,image_data,caption,room_label,is_cover,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,kind,caption,room_label,is_cover,sort_order,revision`, [key,kind === 'layouts' ? 'floor_plan' : 'render',contentType,file.buffer,caption,room,cover,count])).rows[0]; for (const product of linked) await c.query('INSERT INTO interior_image_products(image_id,design_id,product_id) VALUES($1,$2,$3)', [image.id,key,product]); await audit(c, actor, 'upload_image', kind, key, null, { ...image, product_ids: linked }); return { image, record: await bump(c, kind, key) }; }); res.status(201).json(receipt);
 }));
 router.use((error, _req, res, next) => { if (error && error.name === 'MulterError') return res.status(400).json({ error: 'Upload rejected: one image, maximum 10 MiB' }); next(error); });
 return router;
}
function mount(app) { const multer = require('multer'); app.use('/api/admin/interiors', createRouter({ express: require('express'), db: require('../db/catalogue'), requireAdmin: require('../middleware/require-admin').requireAdmin, upload: multer({ storage: multer.memoryStorage(), limits: { fileSize: 10485760, files: 1, fields: 8, fieldSize: 65536, parts: 9 } }) })); }
module.exports = { createRouter, mount, validate, products, imageType };
