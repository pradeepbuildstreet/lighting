'use strict';
const crypto=require('node:crypto');
const {uuid}=require('../services/public-catalogue-v1');
const {selection}=require('./interior-public');
const {priceInteriorPackage}=require('../services/interior-package-pricing');
function fail(status,message){throw Object.assign(Error(message),{status});}
function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['request_key','design_id','products','name','mobile_number','email','pin_code','requirements'].includes(k)))fail(400,'Invalid enquiry');
 const clean=(key,max,required=false)=>{const v=body[key]??'';if(typeof v!=='string'||v.length>max||required&&!v.trim())fail(400,'Invalid '+key);return v.trim();};
 const name=clean('name',160,true);if(name.length<2)fail(400,'Enter your name');
 const digits=clean('mobile_number',20,true).replace(/\D/g,'');const mobile=digits.length===12&&digits.startsWith('91')?digits.slice(2):digits;if(!/^[6-9]\d{9}$/.test(mobile))fail(400,'Enter a valid Indian mobile number');
 const email=clean('email',254).toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Invalid email');const pin_code=clean('pin_code',6,true);if(!/^[1-9]\d{5}$/.test(pin_code))fail(400,'Invalid PIN code');
 const products=selection(body.products).sort((a,b)=>a.product_id.localeCompare(b.product_id));if(!products.length||products.length>100)fail(400,'Select between 1 and 100 distinct products');
 return {request_key:uuid(body.request_key),design_id:uuid(body.design_id),products,name,mobile_number:'+91'+mobile,email:email||null,pin_code,requirements:clean('requirements',5000)};
}
function digest(input){return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');}
function createService({db,appDb,lookup}){
 async function submit(body){const input=validate(body),hash=digest(input);
  return appDb.withTransaction(async c=>{
   await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='30s'");
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['interior-enquiry:'+input.request_key]);
   const old=(await c.query('SELECT id,share_token,interior_request_digest,interior_package_snapshot FROM wishlists WHERE interior_request_key=$1',[input.request_key])).rows[0];
   if(old){if(old.interior_request_digest!==hash)fail(409,'This request key was used for a different selection. Restore the original selection or start a new enquiry.');return {enquiry_reference:old.share_token,pricing:old.interior_package_snapshot.pricing,replayed:true};}
   const source=await db.transaction(async catalogue=>{
    await catalogue.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await catalogue.query("SET LOCAL statement_timeout='10s'");
    const row=(await catalogue.query('SELECT d.id AS design_id,d.name AS design_name,d.revision,l.id AS layout_id,l.name AS layout_name,p.id AS project_id,p.name AS project_name FROM interior_designs d JOIN interior_layouts l ON l.id=d.layout_id JOIN interior_projects p ON p.id=l.project_id WHERE d.id=$1 AND d.published AND l.published AND p.published',[input.design_id])).rows[0];if(!row)fail(404,'Published design not found');
    const members=(await catalogue.query('SELECT dp.product_id,p.is_active,p.revision FROM interior_design_products dp JOIN products p ON p.id=dp.product_id WHERE dp.design_id=$1 AND dp.product_id=ANY($2::uuid[])',[input.design_id,input.products.map(p=>p.product_id)])).rows;
    if(members.length!==input.products.length||members.some(p=>!p.is_active))fail(409,'A selected product is unavailable or does not belong to this design');return {design:row,members};
   });
   const items=[];for(const selected of input.products){const p=await lookup(selected.product_id);if(String(p.catalogue_revision)!==String(source.members.find(m=>m.product_id===selected.product_id).revision))fail(409,'Product changed while submitting. Refresh prices and retry.');items.push({...p,quantity:selected.quantity});}
   const pricing=priceInteriorPackage(items.map(p=>({productId:p.product_id,quantity:p.quantity,unitListPrice:p.price,productDiscountPercent:p.default_discount_percent})));
   const snapshot={version:1,...source.design,pricing,products:items,submitted_at:new Date().toISOString()};
   const saved=(await c.query("INSERT INTO wishlists(session_hash,share_token,customer_name,mobile_number,email,pin_code,requirements,status,submitted_at,communication_channel,interior_package_snapshot,interior_request_key,interior_request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,'submitted',NOW(),'website',$8,$9,$10) RETURNING id,share_token",[crypto.randomBytes(32).toString('hex'),crypto.randomBytes(24).toString('hex'),input.name,input.mobile_number,input.email,input.pin_code,input.requirements,JSON.stringify(snapshot),input.request_key,hash])).rows[0];
   for(const p of items)await c.query('INSERT INTO wishlist_items(wishlist_id,product_id,sku,name,price,currency,image_url,media,product_href,catalogue_revision,default_discount_percent,add_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[saved.id,p.product_id,p.sku,p.name,p.price,p.currency,p.image_url,JSON.stringify(p.media),p.product_href,p.catalogue_revision,p.default_discount_percent,p.quantity]);
   return {enquiry_reference:saved.share_token,pricing,replayed:false};
  });
 }
 return {submit};
}
function mount(app){const express=require('express'),router=express.Router(),service=createService({db:require('../db/catalogue'),appDb:require('../db/database'),lookup:require('../services/wishlist-catalogue').lookup});
 router.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});if(!require('./public-catalogue-v1').enabled(process.env))return res.status(404).json({error:'Not found'});next();});
 router.use(require('express-rate-limit')({windowMs:60000,limit:10,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many enquiry requests. Please wait.'}}));
 router.post('/',(req,res,next)=>{const origin=req.get('origin');if(!origin||!require('../config/runtime').loadConfig().origins.includes(origin))return res.status(403).json({error:'Allowed Origin required'});next();},async(req,res)=>{try{const result=await service.submit(req.body);res.status(result.replayed?200:201).json(result);}catch(e){console.error('[interior-enquiries]',e.code||e.status||'ERROR');const status=[400,404,409].includes(e.status)?e.status:503;res.status(status).json({error:e.status?e.message:'Could not confirm enquiry. Retry the same request key; do not create a new request.'});}});
 app.use('/api/interior-enquiries',router);
}
module.exports={validate,digest,createService,mount};
