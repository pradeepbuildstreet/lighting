"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE=50;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function identifier(value){if(typeof value!=='string'||!UUID.test(value))fail(400,'Valid history identifier required');return value.toLowerCase();}
function createResolutionHistoryService(db){
 async function read(actor,work){return db.transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await c.query("SET LOCAL statement_timeout='15s'");
  await c.query("SET LOCAL lock_timeout='3s'");
  await db.actor(c,actor);
  const installed=(await c.query("SELECT to_regclass('public.product_duplicate_groups') IS NOT NULL AND to_regclass('public.product_duplicate_group_items') IS NOT NULL AS installed")).rows[0]?.installed;
  if(installed!==true)fail(503,'Resolution history prerequisite is not installed');
  return work(c);
 });}
 async function list(actor,productId,before){
  const id=identifier(productId),cursor=before===undefined?null:identifier(before);
  return read(actor,async c=>{
   const product=(await c.query('SELECT id,sku,name,revision,review_status,duplicate_of_product_id,is_active,published FROM public.products WHERE id=$1',[id])).rows[0];
   if(!product)fail(404,'Product not found');
   if(cursor&&!(await c.query('SELECT group_id FROM public.product_duplicate_group_items WHERE group_id=$1 AND product_id=$2',[cursor,id])).rows.length)fail(400,'History cursor does not belong to this product');
   const rows=(await c.query(`SELECT g.id,g.reviewer_id,g.notes,g.created_at,g.member_count,g.algorithm_version,g.corpus_digest,
    i.reviewed_revision,i.decision,i.duplicate_of_product_id,i.audit_id,i.review_id
    FROM public.product_duplicate_groups g JOIN public.product_duplicate_group_items i ON i.group_id=g.id
    WHERE i.product_id=$1 AND ($2::uuid IS NULL OR (g.created_at,g.id)<(SELECT created_at,id FROM public.product_duplicate_groups WHERE id=$2))
    ORDER BY g.created_at DESC,g.id DESC LIMIT 51`,[id,cursor])).rows;
   const groups=rows.slice(0,PAGE_SIZE);
   return {product,groups,next_cursor:rows.length>PAGE_SIZE?groups[groups.length-1].id:null,reversal_history_available:false};
  });
 }
 async function detail(actor,groupId){
  const id=identifier(groupId);
  return read(actor,async c=>{
   const group=(await c.query('SELECT id,reviewer_id,notes,member_count,algorithm_version,corpus_digest,created_at FROM public.product_duplicate_groups WHERE id=$1',[id])).rows[0];
   if(!group)fail(404,'Group resolution not found');
   const items=(await c.query(`SELECT i.*,a.product_revision AS audit_product_revision,a.status AS audit_status,
    a.algorithm_version AS audit_algorithm_version,a.corpus_digest AS audit_corpus_digest,
    a.created_at AS audit_created_at,a.completed_at AS audit_completed_at,
    r.decision AS review_decision,r.duplicate_of_product_id AS review_target,r.reviewer_id,
    r.notes AS review_notes,r.created_at AS review_created_at,r.group_resolution_id
    FROM public.product_duplicate_group_items i JOIN public.product_duplicate_audits a ON a.id=i.audit_id
    JOIN public.product_duplicate_reviews r ON r.id=i.review_id WHERE i.group_id=$1 ORDER BY i.product_id`,[id])).rows;
   return {group,items,reversal_history_available:false};
  });
 }
 return {list,detail};
}
module.exports={PAGE_SIZE,createResolutionHistoryService};
