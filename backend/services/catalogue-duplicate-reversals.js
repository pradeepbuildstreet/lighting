"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function uuid(v){if(typeof v!=='string'||!UUID.test(v))fail(400,'Valid reversal identifier required');return v.toLowerCase();}
function parseReversal(productId,body){
 const fields=['expected_revision','expected_review_id','expected_group_resolution_id','expected_target_product_id','request_key','reason'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k))||fields.some(k=>!Object.prototype.hasOwnProperty.call(body,k)))fail(400,'Complete reversal expectations required');
 const revision=String(body.expected_revision);
 if(!/^[1-9][0-9]{0,18}$/.test(revision)||(typeof body.expected_revision==='number'&&!Number.isSafeInteger(body.expected_revision))||BigInt(revision)>=9223372036854775807n)fail(400,'Current product revision required');
 if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.trim().length>5000)fail(400,'Reversal reason required, maximum 5000 characters');
 return {product_id:uuid(productId),expected_revision:revision,expected_review_id:uuid(body.expected_review_id),expected_group_resolution_id:body.expected_group_resolution_id===null?null:uuid(body.expected_group_resolution_id),expected_target_product_id:uuid(body.expected_target_product_id),request_key:uuid(body.request_key),reason:body.reason.trim()};
}
function createDuplicateReversalService(db){
 async function reverse(actor,id,body){
  const input=parseReversal(id,body);
  try{return await db.transaction(async c=>{
   await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='30s'");
   await c.query('SELECT pg_advisory_xact_lock(8102401)');await c.query('SELECT pg_advisory_xact_lock(8102403)');
   await db.actor(c,actor);
   const ready=(await c.query("SELECT to_regprocedure('public.reverse_confirmed_duplicate(uuid,bigint,uuid,uuid,uuid,uuid,text)') IS NOT NULL AS installed")).rows[0]?.installed;
   if(ready!==true)fail(503,'Audited reversal prerequisite is not installed');
   const result=(await c.query('SELECT public.reverse_confirmed_duplicate($1::uuid,$2::bigint,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::text) AS result',Object.values(input))).rows[0]?.result;
   if(!result||typeof result.reversal?.id!=='string'||typeof result.replayed!=='boolean')fail(503,'Reversal receipt unavailable; retry only the identical request');
   return result;
  });}catch(e){
   if(['40001','23505','55P03'].includes(e.code))fail(409,'Reversal conflicts with current state or request key; reload, or retry the identical uncertain request');
   if(e.code==='42501')fail(403,'Active administrator required');
   if(e.code==='22023')fail(400,'Complete reversal expectations and a reason are required');
   if(e.code==='P0002')fail(404,'Product not found');
   throw e;
  }
 }
 async function history(actor,productId){
  const id=uuid(productId);
  return db.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.query("SET LOCAL statement_timeout='15s'");await db.actor(c,actor);
   const ready=(await c.query("SELECT to_regclass('public.product_duplicate_reversals') IS NOT NULL AS installed")).rows[0]?.installed;
   if(ready!==true)fail(503,'Reversal history prerequisite is not installed');
   if(!(await c.query('SELECT id FROM public.products WHERE id=$1',[id])).rows.length)fail(404,'Product not found');
   const rows=(await c.query('SELECT * FROM public.product_duplicate_reversals WHERE product_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101',[id])).rows;
   return {product_id:id,reversals:rows.slice(0,100),limit:100,has_more:rows.length>100};
  });
 }
 return {reverse,history};
}
module.exports={parseReversal,createDuplicateReversalService};
