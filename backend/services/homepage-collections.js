"use strict";
const {randomUUID}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status,message){const e=Error(message);e.status=status;throw e;}
function id(value){if(typeof value!=='string'||!UUID.test(value))fail(400,'Valid UUID required');return value.toLowerCase();}
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,'Invalid text field');return value.trim();}
function validate(body,editing=false){
 const allowed=['title','slug','description','is_active','sort_order','cover_product_id','product_ids','revision'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Unsupported collection field');
 const title=text(body.title,120,true),slug=text(body.slug,100,true),description=text(body.description??'',2000);
 if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))fail(400,'Use a lowercase hyphenated slug');
 if(typeof body.is_active!=='boolean'||!Number.isInteger(body.sort_order)||body.sort_order<0||body.sort_order>100000)fail(400,'Active state and integer display order required');
 if(!Array.isArray(body.product_ids)||body.product_ids.length>500)fail(400,'Select at most 500 products');
 const product_ids=body.product_ids.map(id);if(new Set(product_ids).size!==product_ids.length)fail(400,'Duplicate product membership');
 const cover_product_id=body.cover_product_id?id(body.cover_product_id):null;
 if(cover_product_id&&!product_ids.includes(cover_product_id))fail(400,'Cover product must belong to this collection');
 if(editing&&(!Number.isInteger(body.revision)||body.revision<1))fail(400,'Current revision required');
 return {title,slug,description,is_active:body.is_active,sort_order:body.sort_order,cover_product_id,product_ids,revision:body.revision};
}
function skuInput(input){
 if(typeof input!=='string'||input.length>50000)fail(400,'Enter SKUs separated by commas or new lines');
 const values=input.split(/[,\r\n]+/).map(s=>s.trim()).filter(Boolean);
 if(values.length>500||values.some(s=>s.length>100))fail(400,'At most 500 SKUs of 100 characters each');
 const seen=new Set(),duplicates=new Set();for(const s of values){if(seen.has(s))duplicates.add(s);seen.add(s);}
 return {skus:[...seen],duplicates:[...duplicates]};
}
const COUNTS=`SELECT i.product_id,COUNT(DISTINCT w.id)::integer AS enquiry_count
 FROM wishlist_items i JOIN wishlists w ON w.id=i.wishlist_id
 WHERE w.submitted_at IS NOT NULL AND i.product_id IS NOT NULL`;
function createService({db,appDb,publicCatalogue}){
 async function ready(){if(!(await db.query('SELECT version FROM homepage_feature_versions WHERE version=1')).rows.length)fail(503,'Homepage migration required');}
 async function counts(ids){ids=ids.map(id);if(ids.length>500)fail(400,'At most 500 product IDs');if(!ids.length)return new Map();const rows=(await appDb.query(COUNTS+' AND i.product_id=ANY($1::uuid[]) GROUP BY i.product_id',[ids])).rows;return new Map(rows.map(r=>[r.product_id,Number(r.enquiry_count)]));}
 async function list(){await ready();return {collections:(await db.query(`SELECT c.*,(SELECT count(*)::integer FROM homepage_collection_products cp WHERE cp.collection_id=c.id) AS product_count FROM homepage_collections c ORDER BY sort_order,title,id LIMIT 200`)).rows};}
 async function detail(value){await ready();const key=id(value),collection=(await db.query('SELECT * FROM homepage_collections WHERE id=$1',[key])).rows[0];if(!collection)fail(404,'Collection not found');const products=(await db.query(`SELECT p.id,p.sku,p.name,cp.sort_order FROM homepage_collection_products cp JOIN products p ON p.id=cp.product_id WHERE cp.collection_id=$1 ORDER BY cp.sort_order,p.id`,[key])).rows;const stats=await counts(products.map(p=>p.id));return {collection,products:products.map(p=>({...p,enquiry_count:stats.get(p.id)||0}))};}
 async function search(q=''){q=text(q,200);const products=(await db.query("SELECT id,sku,name FROM products WHERE ($1='' OR position(lower($1) in lower(sku))>0 OR position(lower($1) in lower(name))>0) ORDER BY name,id LIMIT 100",[q])).rows;const stats=await counts(products.map(p=>p.id));return {products:products.map(p=>({...p,enquiry_count:stats.get(p.id)||0})),limit:100};}
 async function resolve(input){const parsed=skuInput(input);if(!parsed.skus.length)return {products:[],missing:[],duplicates:[]};const rows=(await db.query('SELECT id,sku,name FROM products WHERE sku=ANY($1::text[])',[parsed.skus])).rows,map=new Map(rows.map(p=>[p.sku,p]));return {products:parsed.skus.filter(s=>map.has(s)).map(s=>map.get(s)),missing:parsed.skus.filter(s=>!map.has(s)),duplicates:parsed.duplicates};}
 async function save(value,body,admin){
  const key=value?id(value):randomUUID(),data=validate(body,!!value),actor=id(admin.id);await ready();
  return db.transaction(async c=>{
   await c.query("SET LOCAL statement_timeout='10s'");await c.query('SELECT pg_advisory_xact_lock(71420516)');
   const old=value?(await c.query('SELECT * FROM homepage_collections WHERE id=$1 FOR UPDATE',[key])).rows[0]:null;
   if(value&&!old)fail(404,'Collection not found');if(old&&Number(old.revision)!==data.revision)fail(409,'Collection changed. Reload before saving.');
   if(!value&&Number((await c.query('SELECT count(*) AS total FROM homepage_collections')).rows[0].total)>=200)fail(409,'Collection limit reached (200)');
   if(data.product_ids.length){const found=(await c.query('SELECT id FROM products WHERE id=ANY($1::uuid[]) FOR KEY SHARE',[data.product_ids])).rows;if(found.length!==data.product_ids.length)fail(400,'One or more products no longer exist');}
   const oldMembers=old?(await c.query('SELECT product_id FROM homepage_collection_products WHERE collection_id=$1 ORDER BY sort_order',[key])).rows.map(r=>r.product_id):[];
   const values=[key,data.title,data.slug,data.description,data.is_active,data.sort_order,data.cover_product_id];
   const row=(await c.query(value?`UPDATE homepage_collections SET title=$2,slug=$3,description=$4,is_active=$5,sort_order=$6,cover_product_id=$7,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`:`INSERT INTO homepage_collections(id,title,slug,description,is_active,sort_order,cover_product_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,values)).rows[0];
   await c.query('DELETE FROM homepage_collection_products WHERE collection_id=$1',[key]);
   if(data.product_ids.length)await c.query('INSERT INTO homepage_collection_products(collection_id,product_id,sort_order) SELECT $1,value,(ordinality-1)::integer FROM unnest($2::uuid[]) WITH ORDINALITY AS members(value,ordinality)',[key,data.product_ids]);
   await c.query('INSERT INTO homepage_collection_audit(collection_id,actor_id,action,before_state,after_state) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',[key,actor,value?'update':'create',old?JSON.stringify({...old,product_ids:oldMembers}):null,JSON.stringify({...row,product_ids:data.product_ids})]);
   return {collection:row};
  });
 }
 async function popular(limit=12){
  const ranked=(await appDb.query(COUNTS+' GROUP BY i.product_id ORDER BY enquiry_count DESC,i.product_id LIMIT 5001')).rows;
  const products=[];
  for(let i=0;i<Math.min(ranked.length,5000)&&products.length<limit;i+=100){const chunk=ranked.slice(i,Math.min(i+100,5000)),visible=(await publicCatalogue.byIds(chunk.map(r=>r.product_id))).products,map=new Map(visible.map(p=>[p.id,p]));for(const r of chunk)if(map.has(r.product_id)){products.push({...map.get(r.product_id),enquiry_count:Number(r.enquiry_count)});if(products.length===limit)break;}}
  return {products,period:'all_time_submitted_enquiries',scan_limited:ranked.length>5000&&products.length<limit};
 }
 async function publicCollection(slug,page=1){
  if(typeof slug!=='string'||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))fail(400,'Invalid collection slug');if(!Number.isInteger(page)||page<1||page>999)fail(400,'Invalid collection page');await ready();
  const c=(await db.query('SELECT id,title,slug,description,cover_product_id FROM homepage_collections WHERE slug=$1 AND is_active=true',[slug])).rows[0];if(!c)fail(404,'Collection not found');
  const members=(await db.query('SELECT product_id FROM homepage_collection_products WHERE collection_id=$1 ORDER BY sort_order,product_id LIMIT 500',[c.id])).rows;
  const result=await publicCatalogue.byIds(members.map(m=>m.product_id),{page,limit:24,cover_id:c.cover_product_id});
  return {collection:{title:c.title,slug:c.slug,description:c.description},products:result.products,pagination:{page,limit:24,total:result.total,pages:Math.ceil(result.total/24)}};
 }
 async function homepage(){await ready();return {...await popular(),collections:await publicCatalogue.collectionTiles()};}
 return {ready,counts,list,detail,search,resolve,save,popular,publicCollection,homepage};
}
module.exports={createService,validate,skuInput,id,COUNTS};
