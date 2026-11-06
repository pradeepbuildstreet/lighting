"use strict";
const {percent}=require('../services/product-discount-core');
const {parseDiscountFilters}=require('../services/discount-filter-core');
const {assertPreserved}=require('../services/catalogue-product-operations');
const {uuid}=require('../services/public-catalogue-v1');
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function createRouter(express,db,audit){
 const router=express.Router();
 router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');if(!req.admin?.id)return res.status(401).json({error:'Admin sign-in required'});next();});
 const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){const status=e.status||(['23514','22P02'].includes(e.code)?400:503);console.error(JSON.stringify({event:'product_discount_failed',code:e.code||'ERROR'}));res.status(status).json({error:e.status?e.message:'Discount operation unavailable. Verify migration 12 and reload saved state before retrying.'});}};
 router.get('/',route(async(req,res)=>{
  const q=String(req.query.q||'').trim();if(q.length>200)fail(400,'Search is too long');
  const page=Number(req.query.page||1);if(!Number.isInteger(page)||page<1||page>10000)fail(400,'Invalid page');
  const id=req.query.product_id?uuid(req.query.product_id):null,filter=parseDiscountFilters(req.query);let ids=null;
  if(req.query.ids!==undefined){if(typeof req.query.ids!=='string'||!req.query.ids||req.query.ids.length>1850)fail(400,'Supply 1 to 50 product UUIDs');const raw=req.query.ids.split(',');if(raw.length>50)fail(400,'Supply at most 50 product UUIDs');ids=[...new Set(raw.map(uuid))];}
  const where="WHERE ($1='' OR position(lower($1) in lower(coalesce(p.name,'')))>0 OR position(lower($1) in lower(coalesce(p.sku,'')))>0) AND ($2::uuid IS NULL OR p.id=$2::uuid) AND ($3::uuid[] IS NULL OR p.id=ANY($3::uuid[])) AND ($4::text='all' OR ($4::text='discounted' AND p.default_discount_percent>0) OR ($4::text='none' AND p.default_discount_percent=0)) AND ($5::numeric IS NULL OR p.default_discount_percent>=$5::numeric) AND ($6::numeric IS NULL OR p.default_discount_percent<=$6::numeric)";
  const args=[q,id,ids,filter.status,filter.min,filter.max];
  const data=await db.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='10s'");
   const total=Number((await c.query('SELECT count(*) AS total FROM products p '+where,args)).rows[0].total);
   const products=(await c.query('SELECT p.id,p.sku,p.name,p.currency,p.selling_price,p.default_discount_percent,round(p.selling_price*(1-p.default_discount_percent/100),2) AS discounted_price,md5(to_jsonb(p)::text) AS edit_token FROM products p '+where+' ORDER BY p.sku NULLS LAST,p.id LIMIT 50 OFFSET $7',[...args,(page-1)*50])).rows;
   return {products,filters:filter,pagination:{page,total,pages:Math.ceil(total/50)}};
  });res.json(data);
 }));
 router.post('/bulk',route(async(req,res)=>{
  if(!req.body||Object.keys(req.body).some(k=>k!=='items')||!Array.isArray(req.body.items)||!req.body.items.length||req.body.items.length>50)fail(400,'Select between 1 and 50 products');
  const items=req.body.items.map(item=>{if(!item||typeof item!=='object'||Object.keys(item).some(k=>!['id','default_discount_percent','expected_token'].includes(k)))fail(400,'Invalid discount update');if(!/^[a-f0-9]{32}$/.test(item.expected_token||''))fail(400,'Reload the product edit token');return {id:uuid(item.id),value:percent(item.default_discount_percent),token:item.expected_token};}).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(items.map(i=>i.id)).size!==items.length)fail(400,'Each product must appear once');
  const products=await db.transaction(async c=>{
   await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='15s'");await c.query('SELECT pg_advisory_xact_lock(8102401)');await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,req.admin);
   const results=[];for(const item of items){
    const locked=(await c.query('SELECT p.*,md5(to_jsonb(p)::text) AS edit_token FROM products p WHERE p.id=$1 FOR UPDATE OF p',[item.id])).rows[0];if(!locked)fail(404,'Product not found');if(locked.edit_token!==item.token)fail(409,'A selected product changed. No updates were saved; reload and preview again.');
    const {edit_token,...before}=locked;if(Number(before.default_discount_percent)!==Number(item.value)){await c.query('UPDATE products SET default_discount_percent=$2 WHERE id=$1',[item.id,item.value]);const after=(await c.query('SELECT * FROM products WHERE id=$1',[item.id])).rows[0];assertPreserved(before,after);if(String(before.selling_price)!==String(after.selling_price)||before.is_active!==after.is_active)fail(409,'Discount update changed another price or status; no updates were saved');await audit(c,req.admin,'products',item.id,'update_default_discount',before,after);}results.push({id:item.id,default_discount_percent:item.value});
   }return results;
  });res.json({saved:true,products});
 }));return router;
}
module.exports={createRouter};
