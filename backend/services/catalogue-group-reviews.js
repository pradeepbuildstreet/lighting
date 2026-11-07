"use strict";
const crypto=require('node:crypto'),V=require('../validators/catalogue');
const G=require('./catalogue-group-review-policy'),P=require('./catalogue-duplicate-model');
const R=require('./catalogue-resolved-pairs');
const MAX_API_MEMBERS=50;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function canonical(v){if(v instanceof Date)return v.toISOString();if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function keys(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))V.fail('Invalid group review request');}
function ids(value){if(!Array.isArray(value)||value.length<2||value.length>MAX_API_MEMBERS)V.fail('Select between 2 and 50 products for one group confirmation');const result=value.map(v=>V.uuid(v,'group product').toLowerCase()).sort();if(new Set(result).size!==result.length)V.fail('Repeated group product');return result;}
function parseConfirmation(body){
 keys(body,['product_ids','preview_token','request_key','notes','decisions']);
 const product_ids=ids(body.product_ids),request_key=V.uuid(body.request_key,'request key').toLowerCase(),notes=V.text(body.notes,'Review notes',true,5000);
 if(typeof body.preview_token!=='string'||!/^[a-f0-9]{64}$/.test(body.preview_token))V.fail('Reload the group preview');
 if(!Array.isArray(body.decisions)||body.decisions.length!==product_ids.length)V.fail('Record every group product decision');
 const decisions=body.decisions.map(item=>{
  keys(item,['product_id','revision','disposition','duplicate_of_product_id']);
  if(!/^[1-9][0-9]*$/.test(String(item.revision)))V.fail('Current product revision required');
  return {product_id:V.uuid(item.product_id,'decision product').toLowerCase(),revision:String(item.revision),disposition:item.disposition,duplicate_of_product_id:item.duplicate_of_product_id==null?null:V.uuid(item.duplicate_of_product_id,'duplicate target').toLowerCase()};
 }).sort((a,b)=>a.product_id.localeCompare(b.product_id));
 return {product_ids,request_key,notes,preview_token:body.preview_token,decisions};
}
function createGroupReviewService(db,{tagScoring}={}){
 const scoring=()=>tagScoring||require('./catalogue-tag-duplicate-scoring');
 async function begin(c,actor){
  await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='30s'");
  await c.query('SELECT pg_advisory_xact_lock(8102401)');await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,actor);
  const ready=(await c.query("SELECT to_regclass('public.product_duplicate_groups') IS NOT NULL AND to_regclass('public.product_duplicate_group_items') IS NOT NULL AND to_regprocedure('public.validate_duplicate_group_resolution()') IS NOT NULL AND position('subject-revision-and-group-v2' IN pg_get_functiondef(to_regprocedure('public.current_duplicate_approval(uuid,bigint,uuid,text)')))>0 AS installed")).rows[0]?.installed;
  if(ready!==true)fail(503,'Group-review database prerequisite is not installed');
  if(!(await c.query('SELECT version FROM catalogue_taxonomy_versions WHERE version=3')).rows.length)fail(503,'Integrated tag-product cutover is not activated');
 }
 async function snapshot(c,selected){
  const rows=(await c.query('SELECT p.* FROM products p ORDER BY p.id LIMIT 1001 FOR SHARE OF p')).rows;
  if(rows.length>1000)fail(409,'Catalogue exceeds the synchronous audit limit');
  const records=await scoring().loadEvidence(c,rows),members=selected.map(id=>records.find(p=>p.id===id));
  if(members.some(p=>!p))fail(404,'A group product no longer exists');
  for(const p of members){G.assertEligibleSubject(p);if(!p.attributes||p.attributes.kind_code!==p.product_kind)fail(409,'Every group product requires matching tag-model attributes');}
  if(scoring().ALGORITHM!==P.TAG_ALGORITHM)fail(503,'Current tag-evidence algorithm required');
  const heads=(await c.query(`SELECT p.id AS product_id,a.id AS audit_id,r.id AS review_id FROM products p
   LEFT JOIN LATERAL(SELECT id FROM product_duplicate_audits WHERE product_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1)a ON true
   LEFT JOIN LATERAL(SELECT id FROM product_duplicate_reviews WHERE audit_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1)r ON true
   WHERE p.id=ANY($1::uuid[]) ORDER BY p.id`,[selected])).rows;
  const corpus_digest=P.tagDigest(records),book=await R.loadResolvedPairs(c,records);
  const {comparisons,outside_product_ids,resolved_comparisons}=R.partitionComparisons(records,members,(a,b)=>scoring().compare(a,b),book,G.eligibleForDuplicateReview);
  const preview_token=hash({format:'group-review-preview-v2-resolved-pairs',corpus_digest,selected,comparisons,resolved_comparisons,heads:heads.sort((a,b)=>a.product_id.localeCompare(b.product_id)),members:members.map(p=>({id:p.id,review_status:p.review_status,approved_revision:p.approved_revision??null,approved_by:p.approved_by??null,approved_at:p.approved_at??null,published:p.published,selling_price:p.selling_price,currency:p.currency}))});
  return {records,members,comparisons,corpus_digest,preview_token,outside_product_ids,resolved_comparisons};
 }
 async function preview(actor,body){keys(body,['product_ids']);const selected=ids(body.product_ids);return db.transaction(async c=>{
  await begin(c,actor);const s=await snapshot(c,selected);
  return {product_ids:selected,products:s.members,comparisons:s.comparisons,preview_token:s.preview_token,outside_product_ids:s.outside_product_ids,can_confirm:s.outside_product_ids.length===0,resolved_comparisons:s.resolved_comparisons.slice(0,200),resolved_comparison_count:s.resolved_comparisons.length};
 });}
 async function result(c,group,replayed){return {group_resolution_id:group.id,replayed,decisions:(await c.query('SELECT product_id,reviewed_revision,decision,duplicate_of_product_id,audit_id,review_id FROM product_duplicate_group_items WHERE group_id=$1 ORDER BY product_id',[group.id])).rows};}
 async function confirm(actor,body){
  const input=parseConfirmation(body),request_digest=hash({format:'group-review-request-v1',...input});
  return db.transaction(async c=>{
   await begin(c,actor);
   const existing=(await c.query('SELECT * FROM product_duplicate_groups WHERE reviewer_id=$1 AND request_key=$2',[actor.id,input.request_key])).rows[0];
   if(existing){if(existing.request_digest!==request_digest)fail(409,'Request key was already used for a different decision');return result(c,existing,true);}
   const s=await snapshot(c,input.product_ids);
   if(s.preview_token!==input.preview_token)fail(409,'Group evidence or review state changed; reload the complete preview');
   if(s.outside_product_ids.length)fail(409,'Resolve outside-group candidates before confirming this group');
   const plan=G.validateGroupDecisions(s.members,input.decisions);
   for(const item of plan)if(item.decision==='confirm_duplicate'&&s.records.some(p=>p.duplicate_of_product_id===item.product_id))fail(409,'Reassign existing incoming duplicate links explicitly before replacing their primary');
   const frozen=JSON.parse(JSON.stringify(s.records)),byId=new Map(frozen.map(p=>[p.id,p]));
   const group=(await c.query(`INSERT INTO product_duplicate_groups(reviewer_id,request_key,request_digest,notes,member_count,algorithm_version,corpus_digest,evidence_snapshot)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[actor.id,input.request_key,request_digest,input.notes,plan.length,P.TAG_ALGORITHM,s.corpus_digest,{format:P.EVIDENCE_FORMAT,products:frozen}])).rows[0];
   const jobs=(await c.query("SELECT to_regclass('public.catalogue_duplicate_jobs') IS NOT NULL AS installed")).rows[0]?.installed===true;
   for(const item of plan){
    const audit=(await c.query(`INSERT INTO product_duplicate_audits(product_id,product_revision,status,algorithm_version,created_by,corpus_digest,scanned_count,created_at,completed_at)
     VALUES($1,$2,'completed',$3,$4,$5,$6,clock_timestamp(),clock_timestamp()) RETURNING id`,[item.product_id,item.revision,P.TAG_ALGORITHM,actor.id,s.corpus_digest,s.records.length-1])).rows[0];
    for(const match of s.comparisons.filter(x=>x.product_id===item.product_id))await c.query('INSERT INTO product_duplicate_candidates(audit_id,product_id,candidate_product_id,overall_score,spec_score,image_score,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',[audit.id,item.product_id,match.candidate_product_id,match.overall_score,match.spec_score??null,match.image_score??null,match.evidence]);
    const review=(await c.query('INSERT INTO product_duplicate_reviews(audit_id,decision,duplicate_of_product_id,reviewer_id,notes,group_resolution_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[audit.id,item.decision,item.duplicate_of_product_id,actor.id,input.notes,group.id])).rows[0];
    await c.query('INSERT INTO product_duplicate_group_items(group_id,product_id,reviewed_revision,audit_id,review_id,decision,duplicate_of_product_id,product_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[group.id,item.product_id,item.revision,audit.id,review.id,item.decision,item.duplicate_of_product_id,byId.get(item.product_id)]);
    const duplicate=item.decision==='confirm_duplicate';
    await c.query(`UPDATE products SET published=false,review_status=$2,duplicate_of_product_id=$3,
     approved_revision=$4,approved_by=$5,approved_at=CASE WHEN $6 THEN NULL ELSE clock_timestamp() END,
     is_active=CASE WHEN $6 THEN false ELSE is_active END WHERE id=$1`,[item.product_id,duplicate?'duplicate':'approved',item.duplicate_of_product_id,duplicate?null:item.revision,duplicate?null:actor.id,duplicate]);
    if(jobs)await c.query(`UPDATE public.catalogue_duplicate_jobs SET status=$2,generation=generation+1,product_revision=$3,audit_id=$4,
     lease_until=NULL,lease_token=NULL,last_error=$5,updated_at=now() WHERE product_id=$1`,[item.product_id,duplicate?'held':'completed',item.revision,audit.id,duplicate?'Confirmed duplicate excluded from review cycles':null]);
    await c.query("INSERT INTO admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,'duplicate_group_review','products',$2,$3,$4)",[actor.id,item.product_id,byId.get(item.product_id),{group_resolution_id:group.id,decision:item.decision,target:item.duplicate_of_product_id}]);
   }
   await c.query('SET CONSTRAINTS public.duplicate_group_complete,public.duplicate_group_item_complete,public.duplicate_group_review_complete IMMEDIATE');
   return result(c,group,false);
  });
 }
 return {preview,confirm};
}
module.exports={MAX_API_MEMBERS,createGroupReviewService};
