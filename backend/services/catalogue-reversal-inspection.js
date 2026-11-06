"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function uuid(v){if(typeof v!=='string'||!UUID.test(v))fail(400,'Valid reversal inspection identifier required');return v.toLowerCase();}
const snapshots=['before_data','after_data','primary_before','primary_after'];
const eventColumns=`r.*,r.expected_revision::text AS expected_revision,r.result_revision::text AS result_revision,${snapshots.map(key=>`CASE WHEN r.${key} IS NULL THEN NULL ELSE r.${key}||jsonb_build_object('revision',r.${key}->>'revision','approved_revision',r.${key}->>'approved_revision') END AS ${key}`).join(',')}`;
function createReversalInspectionService(db){
 async function read(actor,work){return db.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.query("SET LOCAL statement_timeout='15s'");await c.query("SET LOCAL lock_timeout='3s'");await db.actor(c,actor);const installed=(await c.query("SELECT to_regclass('public.product_duplicate_reversals') IS NOT NULL AND to_regprocedure('public.reverse_confirmed_duplicate(uuid,bigint,uuid,uuid,uuid,uuid,text)') IS NOT NULL AS installed")).rows[0]?.installed===true;if(!installed)return {available:false};return work(c);});}
 async function preview(actor,productId){const id=uuid(productId);return read(actor,async c=>{
  const product=(await c.query(`SELECT p.id,p.sku,p.name,p.revision::text AS revision,p.review_status,p.duplicate_of_product_id,p.is_active,p.published,
   a.id AS audit_id,a.status AS audit_status,r.id AS review_id,r.decision AS review_decision,r.group_resolution_id,r.duplicate_of_product_id AS review_target
   FROM public.products p LEFT JOIN LATERAL(SELECT id,status FROM public.product_duplicate_audits WHERE product_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1)a ON true
   LEFT JOIN LATERAL(SELECT id,decision,group_resolution_id,duplicate_of_product_id FROM public.product_duplicate_reviews WHERE audit_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1)r ON true WHERE p.id=$1`,[id])).rows[0];
  if(!product)fail(404,'Product not found');
  const incoming=(await c.query('SELECT id FROM public.products WHERE duplicate_of_product_id=$1 ORDER BY id',[id])).rows.map(r=>r.id);
  const can_reverse=product.review_status==='duplicate'&&!!product.duplicate_of_product_id&&product.audit_status==='completed'&&!!product.review_id&&product.review_decision==='confirm_duplicate'&&product.review_target===product.duplicate_of_product_id&&incoming.length===0;
  return {available:true,product,incoming_product_ids:incoming,can_reverse};
 });}
 async function events(actor,scope,identifier,before){if(!['product','group'].includes(scope))fail(400,'Invalid reversal history scope');const id=uuid(identifier),cursor=before===undefined?null:uuid(before);return read(actor,async c=>{
  const parent=scope==='group'?'product_duplicate_groups':'products';if(!(await c.query('SELECT id FROM public.'+parent+' WHERE id=$1',[id])).rows.length)fail(404,'History subject not found');
  const where=scope==='group'?'r.group_resolution_id=$1::uuid':'(r.product_id=$1::uuid OR r.primary_after->>\'id\'=$1::text)';
  if(cursor&&!(await c.query('SELECT r.id FROM public.product_duplicate_reversals r WHERE '+where+' AND r.id=$2::uuid',[id,cursor])).rows.length)fail(400,'Reversal cursor does not belong to this history');
  const rows=(await c.query('SELECT '+eventColumns+' FROM public.product_duplicate_reversals r WHERE '+where+' AND ($2::uuid IS NULL OR (r.created_at,r.id)<(SELECT created_at,id FROM public.product_duplicate_reversals WHERE id=$2)) ORDER BY r.created_at DESC,r.id DESC LIMIT 51',[id,cursor])).rows;
  const reversals=rows.slice(0,50);return {available:true,reversals,limit:50,has_more:rows.length>50,next_cursor:rows.length>50?reversals[49].id:null};
 });}
 return {preview,events};
}
module.exports={createReversalInspectionService,EVENT_COLUMNS:eventColumns};
