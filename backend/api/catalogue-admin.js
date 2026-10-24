"use strict";
const {attachCompatibilityVisibilityWarnings}=require('../services/compatibility-visibility-warnings');
const express=require('express');const db=require('../db/catalogue');const V=require('../validators/catalogue');
const categoryPolicy=require('../services/category-policy');
const {requireAdmin}=require('../middleware/require-admin');
const products=require('../services/catalogue-products').createProductService(db);
const {audit,detail,writeProduct}=products;
const {visibilityByIds}=require('../services/catalogue-visibility');
const router=express.Router();router.use(requireAdmin);
router.use('/taxonomy',require('./catalogue-taxonomy').createTaxonomyRouter(express,db,audit));
router.use(require('./catalogue-upload-template').createTemplateRouter(express,db));
require('./catalogue-review-mount').mountReviewRoutes(router,express,db);
router.use(require('./catalogue-imports').createImportRouter({express,multer:require('multer'),db,products,parseWorkbook:require('../services/catalogue-workbook').parseWorkbook}));
const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){
 const status=e.status||(['23503','23514','22P02'].includes(e.code)?400:['23505','23P01'].includes(e.code)?409:503);
 const message=e.status?e.message:status===409?'Conflicting SKU, code or price period':status===400?'Invalid reference or field value':'Catalogue unavailable; check configuration and initialization';
 console.error(JSON.stringify({event:'catalogue_request_failed',code:e.code||'VALIDATION',path:req.path}));
 res.status(status).json({error:message});
}};
router.get('/state',route(async(_req,res)=>{
 const result=await db.query('SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1');
 if(result.rows[0]?.version!==3){const e=new Error('Catalogue schema version 3 required');e.status=503;throw e;}
 await db.query('SELECT allow_direct_products FROM categories LIMIT 0');
 res.json({ready:true,schema_version:3,mode:'catalogue_review',publication_enabled:true});
}));
const masters={
 'fixture-types':{table:'fixture_types',fields:['code','name','is_active']},
 'light-types':{table:'light_types',fields:['code','name','base_type','technology','is_active']},
 'dealers':{table:'dealers',fields:['dealer_code','name','contact_person','phone','email','gstin','address','is_active']},
 'categories':{table:'categories',fields:['slug','name','parent_id','description','sort_order','is_active','allow_direct_products']}
};
function masterData(key,b,old={}){
 const m=masters[key],d={name:V.text(b.name,'Name',true,255),is_active:V.bool(b.is_active,true)};
 if(key==='categories'){
  d.slug=V.text(b.slug,'Slug',true,100);if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug))V.fail('Invalid category slug');
  d.parent_id=b.parent_id?V.uuid(b.parent_id,'parent category'):null;d.description=V.text(b.description,'Description',false,5000);d.sort_order=V.num(b.sort_order??0,'Sort order',{integer:true});
  d.allow_direct_products=categoryPolicy.directProducts(b.allow_direct_products,old.allow_direct_products??true);
 }else{
  const code=key==='dealers'?'dealer_code':'code';d[code]=V.text(b[code],code,true,100);if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(d[code]))V.fail('Invalid code');
  if(key==='light-types')for(const f of ['base_type','technology'])d[f]=V.text(b[f],f);
  if(key==='dealers'){
   for(const f of ['contact_person','phone','email','gstin'])d[f]=V.text(b[f],f);
   if(d.email&&!/^\S+@\S+\.\S+$/.test(d.email))V.fail('Invalid email');d.address=V.json(b.address,'address');
  }
 }
 return m.fields.map(f=>d[f]);
}
for(const [key,m] of Object.entries(masters)){
 router.get('/'+key,route(async(_req,res)=>res.json({items:(await db.query(`SELECT * FROM ${m.table} ORDER BY name,id`)).rows})));
 router.post('/'+key,route(async(req,res)=>{
  const values=masterData(key,req.body);
  const item=await db.transaction(async c=>{
   await db.actor(c,req.admin);if(key==='categories')await c.query("SELECT pg_advisory_xact_lock(8102401)");
   const row=(await c.query(`INSERT INTO ${m.table}(${m.fields.join(',')}) VALUES(${m.fields.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,values)).rows[0];
   await audit(c,req.admin,m.table,row.id,'create',null,row);return row;
  });res.status(201).json({item});
 }));
 router.put('/'+key+'/:id',route(async(req,res)=>{
  const id=V.uuid(req.params.id);
  const item=await db.transaction(async c=>{
   await db.actor(c,req.admin);if(key==='categories')await c.query('SELECT pg_advisory_xact_lock(8102401)');
   const old=(await c.query(`SELECT * FROM ${m.table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
   if(!old){const e=new Error('Record not found');e.status=404;throw e;}
   const values=masterData(key,req.body,old);
   if(key==='categories')await categoryPolicy.validateDirectSetting(c,id,values[m.fields.indexOf('allow_direct_products')]);
   const codeField=key==='categories'?'slug':key==='dealers'?'dealer_code':'code';
   if(key!=='categories'&&old[codeField]!==req.body[codeField])V.fail('Codes are immutable; create a new type/dealer instead');
   const row=(await c.query(`UPDATE ${m.table} SET ${m.fields.map((f,i)=>f+'=$'+(i+2)).join(',')} WHERE id=$1 RETURNING *`,[id,...values])).rows[0];
   await audit(c,req.admin,m.table,id,'update',old,row);return row;
  });res.json({item});
 }));
}
router.get('/bootstrap',route(async(_req,res)=>{
 const entries=await Promise.all(Object.entries(masters).map(async([key,m])=>[key,(await db.query(`SELECT * FROM ${m.table} ORDER BY name,id`)).rows]));
 res.json(Object.fromEntries(entries));
}));
router.get('/products',route(async(req,res)=>{
 const term=String(req.query.q||'').trim().slice(0,200);
 const rows=(await db.query(`SELECT p.* FROM products p WHERE ($1='' OR p.sku ILIKE '%'||$1||'%' OR p.name ILIKE '%'||$1||'%') ORDER BY p.updated_at DESC,p.id LIMIT 200`,[term])).rows;
 const visibility=await visibilityByIds(db,rows.map(p=>p.id));
 await attachCompatibilityVisibilityWarnings(db,rows,visibility);
 res.set('Cache-Control','no-store').json({products:rows.map(p=>({...p,visibility:visibility.get(p.id)})),limit:200});
}));
router.get('/products/:id',route(async(req,res)=>{
 const product=await detail(db,V.uuid(req.params.id));
 const visibility=await visibilityByIds(db,[product.id]);
 await attachCompatibilityVisibilityWarnings(db,[product],visibility);
 res.set('Cache-Control','no-store').json({product:{...product,visibility:visibility.get(product.id)}});
}));
router.post('/products',route(async(req,res)=>{
 const data=V.product(req.body);const product=await db.transaction(c=>writeProduct(c,req.admin,null,data,null));res.status(201).json({product});
}));
router.put('/products/:id',route(async(req,res)=>{
 const id=V.uuid(req.params.id),data=V.product(req.body);const revision=V.num(req.body.revision,'revision',{integer:true,positive:true});if(revision===null)V.fail('Revision required');
 const product=await db.transaction(c=>writeProduct(c,req.admin,id,data,revision));res.json({product});
}));
router.get('/products/:id/dealers',route(async(req,res)=>{
 const id=V.uuid(req.params.id);await detail(db,id);
 const rows=(await db.query(`SELECT dp.*,d.name AS dealer_name,d.dealer_code,p.list_price,p.discount_percent,p.net_price,p.currency,p.price_basis,p.valid_from,p.valid_to
 FROM dealer_products dp JOIN dealers d ON d.id=dp.dealer_id
 LEFT JOIN LATERAL(SELECT * FROM dealer_prices p WHERE p.dealer_product_id=dp.id AND p.valid_from<=now() AND (p.valid_to IS NULL OR p.valid_to>now()) AND p.currency='INR' ORDER BY p.valid_from DESC LIMIT 1)p ON true
 WHERE dp.product_id=$1 ORDER BY d.name`,[id])).rows;res.json({listings:rows});
}));
router.post('/products/:id/dealers',route(async(req,res)=>{
 const id=V.uuid(req.params.id),dealer=V.uuid(req.body.dealer_id,'dealer');
 const moq=V.num(req.body.minimum_order_qty??1,'minimum quantity',{integer:true,positive:true}),lead=V.num(req.body.lead_time_days,'lead time',{integer:true});
 const listing=await db.transaction(async c=>{
  await db.actor(c,req.admin);await detail(c,id);
  if(!(await c.query('SELECT id FROM dealers WHERE id=$1 AND is_active=true',[dealer])).rows.length)V.fail('Active dealer required');
  const row=(await c.query(`INSERT INTO dealer_products(product_id,dealer_id,dealer_sku,minimum_order_qty,lead_time_days)
  VALUES($1,$2,$3,$4,$5) ON CONFLICT(dealer_id,product_id) DO UPDATE SET dealer_sku=EXCLUDED.dealer_sku,minimum_order_qty=EXCLUDED.minimum_order_qty,lead_time_days=EXCLUDED.lead_time_days,is_active=true RETURNING *`,[id,dealer,V.text(req.body.dealer_sku,'Dealer SKU'),moq,lead])).rows[0];
  await audit(c,req.admin,'dealer_products',row.id,'attach_or_update',null,row);return row;
 });res.status(201).json({listing});
}));
router.get('/dealer-listings/:id/prices',route(async(req,res)=>res.json({prices:(await db.query('SELECT * FROM dealer_prices WHERE dealer_product_id=$1 ORDER BY valid_from DESC',[V.uuid(req.params.id)])).rows})));
router.post('/dealer-listings/:id/prices',route(async(req,res)=>{
 const id=V.uuid(req.params.id),price=V.num(req.body.list_price,'List price'),discount=V.num(req.body.discount_percent??0,'Discount');
 if(price===null||discount===null||discount>100)V.fail('List price and discount 0–100 required');
 const basis=req.body.price_basis;if(!['tax_inclusive','tax_exclusive'].includes(basis))V.fail('Explicit tax price basis required');
 const tax=V.num(req.body.tax_percent,'Tax percentage');if(tax!==null&&tax>100)V.fail('Invalid tax percentage');
 const currency=req.body.currency||'INR';if(!/^[A-Z]{3}$/.test(currency))V.fail('Invalid currency');
 const result=await db.transaction(async c=>{
  await db.actor(c,req.admin);
  if(!(await c.query('SELECT id FROM dealer_products WHERE id=$1 FOR UPDATE',[id])).rows.length)V.fail('Dealer listing not found');
  const effective=(await c.query('SELECT clock_timestamp() AS t')).rows[0].t;
  if((await c.query('SELECT id FROM dealer_prices WHERE dealer_product_id=$1 AND currency=$2 AND valid_from >= $3',[id,currency,effective])).rows.length){const e=new Error('Future quote exists; price scheduling is not supported in this release');e.status=409;throw e;}
  await c.query('UPDATE dealer_prices SET valid_to=$3 WHERE dealer_product_id=$1 AND currency=$2 AND (valid_to IS NULL OR valid_to>$3)',[id,currency,effective]);
  const row=(await c.query('INSERT INTO dealer_prices(dealer_product_id,currency,list_price,discount_percent,price_basis,tax_percent,valid_from) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id,currency,price,discount,basis,tax,effective])).rows[0];
  await audit(c,req.admin,'dealer_prices',row.id,'quote',null,row);return row;
 });res.status(201).json({price:result});
}));
router.use(require('./catalogue-configuration'));
module.exports=router;
