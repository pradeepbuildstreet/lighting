"use strict";
const crypto=require('node:crypto'),V=require('../validators/catalogue'),S=require('./catalogue-duplicate-scoring');
function error(status,message){const e=new Error(message);e.status=status;throw e;}
function digest(rows){return crypto.createHash('sha256').update(JSON.stringify(rows.map(p=>[p.id,String(p.revision),p.is_active]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');}
function createDuplicateService(db){
 async function auditLog(c,actor,id,action,data){await c.query("INSERT INTO admin_audit_log(actor_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'products',$3,$4)",[actor.id,action,id,data]);}
 async function corpus(c,kind){
  const result=await c.query(`SELECT p.*,CASE WHEN p.product_kind='fixture' THEN to_jsonb(fs) ELSE to_jsonb(ls) END AS specs,
   COALESCE((SELECT array_agg(DISTINCT m.sha256) FROM product_media m WHERE m.product_id=p.id AND m.media_type='image' AND m.sha256 IS NOT NULL),'{}'::text[]) AS image_hashes
   FROM products p LEFT JOIN fixture_specs fs ON fs.product_id=p.id LEFT JOIN light_specs ls ON ls.product_id=p.id
   WHERE p.product_kind=$1 ORDER BY p.id LIMIT 1001 FOR SHARE OF p`,[kind]);
  if(result.rows.length>1000)error(409,'Catalogue exceeds the synchronous audit limit; a complete background scan is required');return result.rows;
 }
 async function run(actor,id,revision){
  V.uuid(id);const expected=V.num(revision,'revision',{integer:true,positive:true});if(expected===null)V.fail('Revision required');
  return db.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,actor);
   const product=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!product)error(404,'Product not found');if(String(product.revision)!==String(expected))error(409,'Product changed; reload');
   const records=await corpus(c,product.product_kind),subject=records.find(p=>p.id===id);if(!subject)error(409,'Subject absent from audit scan');
   const found=records.filter(p=>p.id!==id).map(p=>({candidate:p,result:S.compare(subject,p)})).filter(x=>x.result&&x.result.overall_score>=35).sort((a,b)=>b.result.overall_score-a.result.overall_score||a.candidate.id.localeCompare(b.candidate.id));
   const audit=(await c.query("INSERT INTO product_duplicate_audits(product_id,product_revision,status,algorithm_version,created_by,corpus_digest,scanned_count) VALUES($1,$2,'running',$3,$4,$5,$6) RETURNING *",[id,product.revision,S.ALGORITHM,actor.id,digest(records),records.length-1])).rows[0];
   for(const x of found)await c.query('INSERT INTO product_duplicate_candidates(audit_id,product_id,candidate_product_id,overall_score,spec_score,image_score,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',[audit.id,id,x.candidate.id,x.result.overall_score,x.result.spec_score,null,x.result.evidence]);
   await c.query("UPDATE product_duplicate_audits SET status='completed',completed_at=now() WHERE id=$1",[audit.id]);
   await c.query("UPDATE products SET published=false,approved_revision=NULL,approved_by=NULL,approved_at=NULL,review_status='pending_review',duplicate_of_product_id=NULL WHERE id=$1",[id]);
   // Record the post-status-change corpus snapshot used for freshness checks.
   const updated=records.map(p=>p.id===id?{...p,review_status:'pending_review'}:p);
   await c.query('UPDATE product_duplicate_audits SET corpus_digest=$2 WHERE id=$1',[audit.id,digest(updated)]);
   await auditLog(c,actor,id,'duplicate_audit',{audit_id:audit.id,candidates:found.length,scanned:records.length-1});
   return {audit:{...audit,status:'completed'},candidates:found.map(x=>({candidate_id:x.candidate.id,sku:x.candidate.sku,name:x.candidate.name,...x.result}))};
  });
 }
 async function detail(id){V.uuid(id);const audit=(await db.query('SELECT * FROM product_duplicate_audits WHERE id=$1',[id])).rows[0];if(!audit)error(404,'Audit not found');
  return {audit,candidates:(await db.query('SELECT c.*,p.sku,p.name,p.revision AS current_revision FROM product_duplicate_candidates c JOIN products p ON p.id=c.candidate_product_id WHERE c.audit_id=$1 ORDER BY c.overall_score DESC,p.id',[id])).rows,reviews:(await db.query('SELECT * FROM product_duplicate_reviews WHERE audit_id=$1 ORDER BY created_at,id',[id])).rows};
 }
 async function queue(){return {items:(await db.query("SELECT p.id,p.sku,p.name,p.revision,p.review_status,a.id AS audit_id,a.status AS audit_status,a.product_revision,a.scanned_count FROM products p LEFT JOIN LATERAL(SELECT * FROM product_duplicate_audits a WHERE a.product_id=p.id ORDER BY a.created_at DESC,a.id DESC LIMIT 1)a ON true WHERE p.review_status IN ('draft','pending_audit','pending_review') ORDER BY p.updated_at DESC,p.id LIMIT 200")).rows,limit:200};}
 async function review(actor,auditId,decision,notes,target){
  V.uuid(auditId);if(!['approve_distinct','confirm_duplicate','request_correction','reject'].includes(decision))V.fail('Invalid review decision');notes=V.text(notes,'Review notes',true,5000);
  if(decision==='confirm_duplicate')V.uuid(target,'duplicate target');else if(target)V.fail('Duplicate target is only valid for confirm_duplicate');
  return db.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,actor);
   const audit=(await c.query('SELECT * FROM product_duplicate_audits WHERE id=$1 FOR UPDATE',[auditId])).rows[0];if(!audit)error(404,'Audit not found');
   const product=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[audit.product_id])).rows[0];
   if(!product||audit.status!=='completed'||String(audit.product_revision)!==String(product.revision))error(409,'Audit is stale or incomplete; rerun it');
   const latest=(await c.query('SELECT id FROM product_duplicate_audits WHERE product_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[product.id])).rows[0];if(latest?.id!==auditId)error(409,'A newer audit exists');
   if((await c.query('SELECT id FROM product_duplicate_reviews WHERE audit_id=$1 LIMIT 1',[auditId])).rows.length)error(409,'Audit already reviewed; run a new audit');
   const records=await corpus(c,product.product_kind);if(audit.corpus_digest!==digest(records))error(409,'Catalogue evidence changed; rerun the audit');
   if(decision==='confirm_duplicate'){
    if(target===product.id)V.fail('Cannot duplicate a product onto itself');
    const candidate=(await c.query('SELECT candidate_product_id FROM product_duplicate_candidates WHERE audit_id=$1 AND candidate_product_id=$2',[auditId,target])).rows[0];
    const live=records.find(p=>p.id===target);if(!candidate||!live||!live.is_active||live.duplicate_of_product_id||['duplicate','rejected','archived'].includes(live.review_status))V.fail('Choose an active non-duplicate audit candidate');
   }
   const result=(await c.query('INSERT INTO product_duplicate_reviews(audit_id,decision,duplicate_of_product_id,reviewer_id,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',[auditId,decision,target||null,actor.id,notes])).rows[0];
   const status={approve_distinct:'approved',confirm_duplicate:'duplicate',request_correction:'draft',reject:'rejected'}[decision],approved=decision==='approve_distinct';
   await c.query('UPDATE products SET published=false,review_status=$2,duplicate_of_product_id=$3,approved_revision=$4,approved_by=$5,approved_at=$6 WHERE id=$1',[product.id,status,target||null,approved?product.revision:null,approved?actor.id:null,approved?new Date():null]);
   await auditLog(c,actor,product.id,'duplicate_review',{audit_id:auditId,decision,notes,target:target||null});return {review:result,review_status:status,published:false};
  });
 }
 return {run,detail,queue,review};
}
module.exports={createDuplicateService,digest};
