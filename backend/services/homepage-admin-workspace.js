"use strict";
const original=require('./homepage-collections');
function createService(deps){
 const base=original.createService(deps),db=deps.db;
 async function detail(value){const key=original.id(value);await base.ready();return db.transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='15s'");
  const collection=(await c.query('SELECT * FROM homepage_collections WHERE id=$1',[key])).rows[0];
  if(!collection){const e=Error('Collection not found');e.status=404;throw e;}
  const products=(await c.query(`SELECT p.*,cp.sort_order AS collection_sort_order,(SELECT jsonb_build_object('id',m.id,'url',coalesce(m.external_url,'/api/admin/catalogue/products/'||p.id::text||'/media/'||m.id::text||'/file'),'alt',m.alt_text) FROM product_media m WHERE m.product_id=p.id AND m.media_type='image' AND (m.external_url IS NOT NULL OR m.storage_key IS NOT NULL) ORDER BY m.is_primary DESC,m.sort_order,m.id LIMIT 1) AS thumbnail FROM homepage_collection_products cp JOIN products p ON p.id=cp.product_id WHERE cp.collection_id=$1 ORDER BY cp.sort_order,p.id`,[key])).rows;
  return {collection,products,enquiry_counts_status:'not_requested'};
 });}
 async function save(value,body,admin){const data=original.validate(body,!!value),result=await base.save(value,body,admin);return {...result,product_ids:data.product_ids};}
 return {...base,detail,save};
}
module.exports={createService};
