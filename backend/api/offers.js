"use strict";
const crypto=require('node:crypto'),express=require('express'),fs=require('node:fs/promises'),path=require('node:path');
const {query,pool}=require('../db/database');
const {roundOfferRupees}=require('../services/offer-pricing');
async function withTransaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){try{await client.query('ROLLBACK');}catch(_){}throw error;}finally{client.release();}}
const {requireAdmin}=require('../middleware/require-admin');
const {uuid,storageKey}=require('../services/public-catalogue-v1');
const catalogueDb=require('../db/catalogue');
const availability=require('../services/enquiry-availability');
const {createOfferPdf}=require('../services/offer-pdf');
const router=express.Router();
router.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});next();});
function fail(status,message){throw Object.assign(Error(message),{status});}
function respondError(res,error){
 console.error('[offers]',error.code||error.status||'ERROR',error.message);
 if(res.headersSent)return res.destroy(error);
 const migration=['42703','42P01'].includes(error.code);
 res.status(migration?503:(error.status||500)).json({error:migration?'Quotation availability migration is not installed. Contact the administrator.':error.status?error.message:'Could not process quotation. Please retry.'});
}
function normalizeTerms(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Check the offer terms.');
 const terms={};for(const k of ['gst','payment_terms','payment_details','other_terms']){terms[k]=typeof value[k]==='string'?value[k].trim():'';if(terms[k].length>2000)fail(400,'Offer terms are too long.');}
 const days=value.delivery_days;terms.delivery_days=days==null||days===''?null:Number(days);
 if(terms.delivery_days!==null&&(!Number.isInteger(terms.delivery_days)||terms.delivery_days<1||terms.delivery_days>365))fail(400,'Delivery days must be between 1 and 365.');return terms;
}
function mediaUrl(token,url){return typeof url==='string'&&/^\/api\/catalogue\/media\/[0-9a-f-]{36}$/i.test(url)?'/api/offers/'+encodeURIComponent(token)+'/media/'+url.split('/').pop():url;}
async function getOffer(token){
 const {rows}=await query(`SELECT o.id,o.offer_token,o.version,o.status,o.terms,o.expires_at,o.created_at,COALESCE(to_jsonb(o)->'availability_snapshot','[]'::jsonb) AS availability_snapshot,w.customer_name FROM wishlist_offers o JOIN wishlists w ON w.id=o.wishlist_id WHERE o.offer_token=$1`,[token]);
 if(!rows.length)return null;const offer=rows[0];
 const result=await query('SELECT product_id,currency,media,product_href,catalogue_revision,sku,name,quantity,list_price,offer_price,image_url,category_slug FROM wishlist_offer_items WHERE offer_id=$1 ORDER BY name,sku',[offer.id]);
 const snapshot=Array.isArray(offer.availability_snapshot)?offer.availability_snapshot:[];
 const items=result.rows.map(i=>{const saved=snapshot.find(s=>s.product_id===i.product_id);return {...i,quantity:Number(i.quantity),list_price:Number(i.list_price),offer_price:Number(i.offer_price),requested_quantity:saved?saved.requested_quantity:Number(i.quantity),availability_label:saved&&saved.unavailable_quantity?'Part quantity available':'Full quantity available',availability_note:saved?saved.note:'',image_url:mediaUrl(token,i.image_url),media:(i.media||[]).map(m=>({...m,url:mediaUrl(token,m.url)})),discount_percent:Number(i.list_price)?Math.round((Number(i.list_price)-Number(i.offer_price))/Number(i.list_price)*10000)/100:0};});
 return {...offer,items,unavailable_items:snapshot.filter(s=>s.unavailable_quantity>0),is_partial:snapshot.some(s=>s.unavailable_quantity>0),...availability.totals(items)};
}
async function offerMediaFile(token,id){
 uuid(id);const result=await query('SELECT i.product_id,i.media FROM wishlist_offer_items i JOIN wishlist_offers o ON o.id=i.offer_id WHERE o.offer_token=$1',[token]);
 const item=result.rows.find(i=>(i.media||[]).some(m=>m.id===id&&m.url==='/api/catalogue/media/'+id));if(!item)fail(404,'Media not found.');
 const found=await catalogueDb.query('SELECT storage_key,media_type FROM product_media WHERE id=$1 AND product_id=$2',[id,item.product_id]);const media=found.rows[0];if(!media||!storageKey(media.storage_key))fail(404,'Media not found.');
 const root=await fs.realpath(require('../services/media-storage').getMediaRoot()),file=await fs.realpath(path.join(root,media.storage_key));if(!file.startsWith(root+path.sep))fail(404,'Media not found.');
 const stat=await fs.stat(file);if(!stat.isFile())fail(404,'Media not found.');return {file,size:stat.size,ext:path.extname(file).toLowerCase()};
}
router.get('/enquiry/:shareToken',requireAdmin,async(req,res)=>{try{const result=await query('SELECT o.id,o.offer_token,o.version,o.status,o.terms,o.expires_at,o.created_at FROM wishlist_offers o JOIN wishlists w ON w.id=o.wishlist_id WHERE w.share_token=$1 ORDER BY o.version DESC',[req.params.shareToken]);res.json({offers:result.rows});}catch(e){respondError(res,e);}});
router.get('/enquiry/:shareToken/availability',requireAdmin,async(req,res)=>{try{const state=await withTransaction(async client=>(await availability.load(client,req.params.shareToken)).state);res.json({availability:state});}catch(e){respondError(res,e);}});
router.patch('/enquiry/:shareToken/availability',requireAdmin,async(req,res)=>{try{const state=await withTransaction(client=>availability.save(client,req.params.shareToken,req.body||{}));res.json({availability:state});}catch(e){respondError(res,e);}});
router.post('/enquiry/:shareToken',requireAdmin,async(req,res)=>{try{
 const body=req.body||{},terms=normalizeTerms(body.terms);let expiresAt=null;
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>100)fail(400,'Offer prices are required for available products.');
 const identities=new Set();for(const item of body.items){let id;try{id=uuid(item&&item.product_id);roundOfferRupees(item.offer_price);}catch(_){fail(400,'A catalogue UUID and valid price are required for each item.');}if(identities.has(id))fail(400,'Duplicate quotation product.');identities.add(id);}
 if(body.expires_at){const text=String(body.expires_at);expiresAt=new Date(/^\d{4}-\d{2}-\d{2}$/.test(text)?text+'T23:59:59.999Z':text);if(!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=Date.now())fail(400,'Offer expiry must be a future date.');}
 const offer=await withTransaction(async client=>{
  const current=await availability.load(client,req.params.shareToken);
  const legacyFull=body.availability_version===undefined&&current.items.every(i=>i.available_quantity==null&&!i.availability_note);
  const items=availability.priceQuote(current.items,current.state,legacyFull?{...body,availability_version:current.state.version}:body);
  const version=await client.query('SELECT COALESCE(MAX(version),0)::integer+1 AS version FROM wishlist_offers WHERE wishlist_id=$1',[current.id]);
  const saved=await client.query('INSERT INTO wishlist_offers (wishlist_id,offer_token,version,terms,expires_at,created_by,availability_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,offer_token,version,status,terms,expires_at,created_at',[current.id,crypto.randomBytes(32).toString('hex'),version.rows[0].version,JSON.stringify(terms),expiresAt,req.admin.id,JSON.stringify(current.state.snapshot)]);
  for(const item of items)await client.query('INSERT INTO wishlist_offer_items (offer_id,sku,name,quantity,list_price,offer_price,image_url,category_slug,product_id,currency,media,product_href,catalogue_revision) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[saved.rows[0].id,item.sku,item.name,item.quantity,item.price,item.offer_price,item.image_url,item.category_slug,item.product_id,item.currency,JSON.stringify(item.media||[]),item.product_href,item.catalogue_revision]);
  return saved.rows[0];
 });res.status(201).json({offer});
}catch(e){respondError(res,e);}});
router.get('/:token/media/:id',async(req,res)=>{try{const media=await offerMediaFile(req.params.token,req.params.id),type={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'}[media.ext];if(!type)return res.status(404).json({error:'Media not found.'});res.type(type);res.sendFile(media.file,error=>{if(error&&!res.headersSent)res.status(404).end();});}catch(e){res.status(404).json({error:'Media not found.'});}});
router.get('/:token/pdf',async(req,res)=>{try{const offer=await getOffer(req.params.token);if(!offer)return res.status(404).json({error:'Offer not found.'});await createOfferPdf(offer,res,offerMediaFile);}catch(e){respondError(res,e);}});
router.get('/:token',async(req,res)=>{try{const offer=await getOffer(req.params.token);if(!offer)return res.status(404).json({error:'Offer not found.'});res.json({offer});}catch(e){respondError(res,e);}});
module.exports=router;
