"use strict";
const crypto=require('crypto'),express=require('express');
const {query,withTransaction}=require('../db/database');
const {requireAdmin}=require('../middleware/require-admin');
const {uuid}=require('../services/public-catalogue-v1');
const {lookup,fail}=require('../services/wishlist-catalogue');
const {updateQuantity,storedQuantity}=require('../services/wishlist-quantity');
const router=express.Router();router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
function session(req,res){const id=req.get('x-wishlist-session');if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){res.status(400).json({error:'A valid wishlist session is required.'});return null;}return crypto.createHash('sha256').update(id).digest('hex');}
async function getWishlist(hash){return (await query('SELECT * FROM wishlists WHERE session_hash=$1',[hash])).rows[0]||null;}
async function getItems(id){const result=await query('SELECT product_id,sku,name,price AS list_price,discounted_price,default_discount_percent,currency,image_url,media,product_href,catalogue_revision,category_slug,add_count,add_count AS quantity,created_at,updated_at FROM wishlist_items WHERE wishlist_id=$1 ORDER BY created_at,name',[id]);return result.rows.map(i=>({...i,price:Number(i.discounted_price),list_price:Number(i.list_price),discounted_price:Number(i.discounted_price),default_discount_percent:Number(i.default_discount_percent)}));}
async function response(w){if(!w)return null;const {session_hash,...publicWishlist}=w;return {...publicWishlist,items:await getItems(w.id)};}
function error(res,e){console.error(JSON.stringify({event:'wishlist_request_failed',code:e.code||'ERROR',message:e.message}));res.status(e.status||503).json({error:e.status?e.message:'Wishlist temporarily unavailable. Reload saved state before retrying.'});}
const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){error(res,e);}};
function mobile(value){const d=String(value||'').replace(/\D/g,''),n=d.startsWith('91')&&d.length===12?d.slice(2):d.startsWith('0')&&d.length===11?d.slice(1):d;return /^[6-9]\d{9}$/.test(n)?'+91'+n:null;}
router.get('/session',route(async(req,res)=>{const hash=session(req,res);if(hash)res.json({wishlist:await response(await getWishlist(hash))});}));
router.post('/session/items',route(async(req,res)=>{
 const hash=session(req,res);if(!hash)return;const p=await lookup(req.body.product_id);
 const wishlist=await withTransaction(async c=>{
  await c.query('INSERT INTO wishlists(session_hash,share_token) VALUES($1,$2) ON CONFLICT(session_hash) DO NOTHING',[hash,crypto.randomBytes(24).toString('hex')]);
  const w=(await c.query('SELECT * FROM wishlists WHERE session_hash=$1 FOR UPDATE',[hash])).rows[0];if(w.status!=='draft')fail(409,'This wishlist has already been submitted.');
  const count=Number((await c.query('SELECT count(*) AS count FROM wishlist_items WHERE wishlist_id=$1',[w.id])).rows[0].count);
  const exists=(await c.query('SELECT id FROM wishlist_items WHERE wishlist_id=$1 AND product_id=$2',[w.id,p.product_id])).rows.length>0;if(!exists&&count>=100)fail(409,'A wishlist can contain up to 100 products.');
  await c.query(`INSERT INTO wishlist_items(wishlist_id,product_id,sku,name,price,currency,image_url,media,product_href,catalogue_revision,default_discount_percent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(wishlist_id,product_id) WHERE product_id IS NOT NULL DO UPDATE SET sku=EXCLUDED.sku,name=EXCLUDED.name,price=EXCLUDED.price,currency=EXCLUDED.currency,image_url=EXCLUDED.image_url,media=EXCLUDED.media,product_href=EXCLUDED.product_href,catalogue_revision=EXCLUDED.catalogue_revision,default_discount_percent=EXCLUDED.default_discount_percent,updated_at=NOW()`,[w.id,p.product_id,p.sku,p.name,p.price,p.currency,p.image_url,JSON.stringify(p.media),p.product_href,p.catalogue_revision,p.default_discount_percent]);
  await c.query('UPDATE wishlists SET updated_at=NOW() WHERE id=$1',[w.id]);return w;
 });res.json({wishlist:await response(wishlist)});
}));
router.patch('/session/items/:id',route(async(req,res)=>{const hash=session(req,res);if(!hash)return;const w=await updateQuantity({withTransaction},uuid,hash,req.params.id,req.body?.quantity);res.json({wishlist:await response(w)});}));
router.delete('/session/items/:id',route(async(req,res)=>{const hash=session(req,res);if(!hash)return;const id=uuid(String(req.params.id));const w=await withTransaction(async c=>{const row=(await c.query('SELECT * FROM wishlists WHERE session_hash=$1 FOR UPDATE',[hash])).rows[0];if(!row)fail(404,'Wishlist not found.');if(row.status!=='draft')fail(409,'Submitted wishlists cannot be changed.');await c.query('DELETE FROM wishlist_items WHERE wishlist_id=$1 AND product_id=$2',[row.id,id]);await c.query('UPDATE wishlists SET updated_at=NOW() WHERE id=$1',[row.id]);return row;});res.json({wishlist:await response(w)});}));
router.post('/session/submit',route(async(req,res)=>{
 const hash=session(req,res);if(!hash)return;const name=String(req.body.name||'').trim(),phone=mobile(req.body.mobile_number),email=String(req.body.email||'').trim().toLowerCase()||null,pin=String(req.body.pin_code||'').trim(),requirements=String(req.body.requirements||'').trim();
 if(name.length<2||name.length>160)fail(400,'Enter your name (2 to 160 characters).');if(!phone)fail(400,'Enter a valid 10-digit Indian mobile number.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email address.');if(!/^[1-9][0-9]{5}$/.test(pin))fail(400,'Enter a valid 6-digit Indian PIN code.');if(requirements.length>5000)fail(400,'Requirements must be 5000 characters or fewer.');
 const w=await withTransaction(async c=>{
  const row=(await c.query('SELECT * FROM wishlists WHERE session_hash=$1 FOR UPDATE',[hash])).rows[0];if(!row)fail(404,'Add a product before submitting an enquiry.');if(row.status!=='draft')fail(409,'This wishlist has already been submitted.');
  const items=(await c.query('SELECT * FROM wishlist_items WHERE wishlist_id=$1 ORDER BY id',[row.id])).rows;if(!items.length)fail(400,'Add at least one product before submitting.');
  for(const item of items){storedQuantity(item.add_count);if(!item.product_id)fail(409,'Catalogue identity integrity check failed. Please contact the administrator; no SKU fallback is available.');const p=await lookup(item.product_id);await c.query('UPDATE wishlist_items SET sku=$2,name=$3,price=$4,currency=$5,image_url=$6,media=$7,product_href=$8,catalogue_revision=$9,default_discount_percent=$10,updated_at=NOW() WHERE id=$1',[item.id,p.sku,p.name,p.price,p.currency,p.image_url,JSON.stringify(p.media),p.product_href,p.catalogue_revision,p.default_discount_percent]);}
  return (await c.query("UPDATE wishlists SET customer_name=$2,mobile_number=$3,email=$4,pin_code=$5,requirements=$6,status='submitted',submitted_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *",[row.id,name,phone,email,pin,requirements])).rows[0];
 });res.json({wishlist:await response(w)});
}));
router.post('/session/whatsapp-opened',route(async(req,res)=>{const hash=session(req,res);if(!hash)return;const r=await query("UPDATE wishlists SET communication_channel='whatsapp',whatsapp_opened_at=NOW(),updated_at=NOW() WHERE session_hash=$1 AND status<>'draft' RETURNING share_token,communication_channel,whatsapp_opened_at",[hash]);if(!r.rows.length)fail(404,'Submitted enquiry not found.');res.json({enquiry:r.rows[0]});}));
router.get('/admin',requireAdmin,route(async(_req,res)=>{const r=await query("SELECT w.id,w.share_token,w.customer_name,w.mobile_number,w.email,w.pin_code,w.status,w.communication_channel,w.whatsapp_opened_at,w.updated_at,w.submitted_at,COUNT(i.id)::integer AS item_count,COALESCE(SUM(i.add_count),0)::bigint AS total_quantity FROM wishlists w LEFT JOIN wishlist_items i ON i.wishlist_id=w.id WHERE w.status<>'draft' GROUP BY w.id ORDER BY w.updated_at DESC");res.json({enquiries:r.rows});}));
router.get('/admin/analytics',requireAdmin,route(async(_req,res)=>res.json({products:await require('../services/wishlist-analytics-ui').analytics(query)})));
router.get('/admin/:token',requireAdmin,route(async(req,res)=>{const w=(await query("SELECT * FROM wishlists WHERE share_token=$1 AND status<>'draft'",[req.params.token])).rows[0];if(!w)fail(404,'Enquiry not found.');res.json({enquiry:await response(w)});}));
router.patch('/admin/:token/status',requireAdmin,route(async(req,res)=>{const status=String(req.body.status||'');if(!['contacted','closed'].includes(status))fail(400,'Status must be contacted or closed.');const w=(await query("UPDATE wishlists SET status=$2,updated_at=NOW() WHERE share_token=$1 AND status<>'draft' RETURNING *",[req.params.token,status])).rows[0];if(!w)fail(404,'Enquiry not found.');res.json({enquiry:await response(w)});}));
module.exports=router;
