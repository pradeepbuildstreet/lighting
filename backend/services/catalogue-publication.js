"use strict";
const {compatibilityPublicationWarnings}=require('./compatibility-publication-warnings');
const crypto=require('node:crypto'),V=require('../validators/catalogue');
const {visibilityByIds}=require('./catalogue-visibility');
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function corpusDigest(rows){return crypto.createHash('sha256').update(JSON.stringify(rows.map(p=>[p.id,String(p.revision),p.is_active]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');}
function blockers(product,facts){
 const reasons=[];
 if(product.selling_price===null||product.selling_price===undefined||!Number.isFinite(Number(product.selling_price))||Number(product.selling_price)<0)reasons.push('Valid public selling price required');
 if(product.review_status!=='approved'||String(product.approved_revision)!==String(product.revision)||!product.approved_by)reasons.push(facts.review?.decision==='retain_primary'?'Current retained-primary approval required':'Current distinct approval required');
 if(product.duplicate_of_product_id)reasons.push('Duplicate products cannot be published');
 if(!facts.primaryCategory)reasons.push('Active primary category required');
 if(!facts.primaryImage)reasons.push('Primary image required');
 if(facts.tagModel!==true)reasons.push('Matching tag-model product attributes are required');
 if(!facts.modelPrerequisite)reasons.push('Tag publication database prerequisite is not installed');
 if(!facts.modelActivated)reasons.push('Integrated tag-product cutover is not activated');
 if(facts.modelPrerequisite&&facts.modelActivated&&!facts.activeSpecType)reasons.push('Valid active tag-product attributes, tags and direct-product categories required');
 const a=facts.audit,r=facts.review;
 if(!a||a.status!=='completed'||String(a.product_revision)!==String(product.revision))reasons.push('Latest completed audit must match the current revision');
 if(a?.algorithm_version!=='tags-evidence-v2')reasons.push('Current tags-evidence-v2 audit required');
 const retained=r?.decision==='retain_primary'&&!!r.group_resolution_id&&facts.groupApproval===true;
 if(!r||!(r.decision==='approve_distinct'||retained)||r.reviewer_id!==product.approved_by)reasons.push(r?.decision==='retain_primary'?'Latest retained-primary review requires validated group evidence':'Latest audit review must approve this product as distinct');
 // Corpus freshness is checked before review, not forever after completed approval.
 if(!a?.corpus_digest)reasons.push('Completed audit evidence required');
 return reasons;
}
async function retainedPrimaryApproval(c,product,audit,review){
 if(review?.decision!=='retain_primary'||!review.group_resolution_id||!review.id||!audit?.id
  ||review.audit_id!==audit.id||review.reviewer_id!==product.approved_by)return false;
 const installed=(await c.query("SELECT to_regclass('public.product_duplicate_groups') IS NOT NULL AND to_regclass('public.product_duplicate_group_items') IS NOT NULL AND position('subject-revision-and-group-v2' IN pg_get_functiondef(to_regprocedure('public.current_duplicate_approval(uuid,bigint,uuid,text)')))>0 AS group_approval_installed")).rows[0]?.group_approval_installed;
 if(installed!==true)return false;
 const result=await c.query(`SELECT EXISTS(
  SELECT 1 FROM public.product_duplicate_group_items i
  JOIN public.product_duplicate_groups g ON g.id=i.group_id
  WHERE i.group_id=$1::uuid AND i.product_id=$2::uuid AND i.reviewed_revision=$3::bigint
   AND i.audit_id=$4::uuid AND i.review_id=$5::uuid AND i.decision='retain_primary'
   AND i.duplicate_of_product_id IS NULL AND g.reviewer_id=$6::uuid
   AND g.corpus_digest=$7::text AND g.algorithm_version=$8::text
   AND EXISTS(SELECT 1 FROM public.product_duplicate_group_items d
    WHERE d.group_id=g.id AND d.decision='confirm_duplicate' AND d.duplicate_of_product_id=i.product_id)
   AND public.current_duplicate_approval($2::uuid,$3::bigint,$6::uuid,$9::text)
 ) AS group_approved`,[review.group_resolution_id,product.id,String(product.revision),audit.id,review.id,product.approved_by,audit.corpus_digest,audit.algorithm_version,product.product_kind]);
 return result.rows[0]?.group_approved===true;
}
function createPublicationService(db){
 async function inspect(c,id,locked=false){
  const product=(await c.query(`SELECT p.*,
   EXISTS(SELECT 1 FROM product_attributes a JOIN product_kinds k ON k.id=a.product_kind_id WHERE a.product_id=p.id AND k.code=p.product_kind) AS tag_model,
   to_regprocedure('public.catalogue_product_model_ready(uuid,text)') IS NOT NULL AS model_prerequisite,
   EXISTS(SELECT 1 FROM catalogue_taxonomy_versions WHERE version=3) AS model_activated
   FROM (SELECT * FROM products WHERE id=$1${locked?' FOR UPDATE':''}) p`,[id])).rows[0];if(!product)fail(404,'Product not found');
  const tagModel=product.tag_model===true;
  const primaryCategory=(await c.query('SELECT c.id FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=$1 AND pc.is_primary AND c.is_active'+(locked?' FOR SHARE OF c':''),[id])).rows.length>0;
  const primaryImage=(await c.query("SELECT id FROM product_media WHERE product_id=$1 AND is_primary AND media_type='image'"+(locked?' FOR SHARE':''),[id])).rows.length>0;
  let activeSpecType=false;
  if(tagModel&&product.model_prerequisite===true&&product.model_activated===true)activeSpecType=(await c.query('SELECT public.catalogue_product_model_ready($1::uuid,$2::text) AS ready',[id,product.product_kind])).rows[0]?.ready===true;
  const audit=(await c.query('SELECT * FROM product_duplicate_audits WHERE product_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[id])).rows[0];
  const review=audit?(await c.query('SELECT * FROM product_duplicate_reviews WHERE audit_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[audit.id])).rows[0]:null;
  const groupApproval=await retainedPrimaryApproval(c,product,audit,review);
  const facts={primaryCategory,primaryImage,activeSpecType,audit,review,groupApproval,tagModel,modelPrerequisite:product.model_prerequisite===true,modelActivated:product.model_activated===true};
  const reasons=blockers(product,facts);
  return {product,reasons,can_publish:reasons.length===0,product_model:{tag_model:tagModel,prerequisite_installed:facts.modelPrerequisite,activated:facts.modelActivated,eligible:activeSpecType}};
 }
 async function readinessWithoutCompatibilityWarnings(id){V.uuid(id);return db.transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const state=await inspect(c,id);
  const visibility=await visibilityByIds(c,[id]);
  return {...state,visibility:visibility.get(id)};
 });}
 async function readiness(id){
  const state=await readinessWithoutCompatibilityWarnings(id);
  const compatibility=await compatibilityPublicationWarnings(state.product,db);
  return {...state,compatibility_warnings:compatibility.warnings,compatibility_validation:{status:compatibility.status}};
 }
 async function set(actor,id,revision,publish){
  V.uuid(id);const expected=V.num(revision,'revision',{integer:true,positive:true});if(expected===null)V.fail('Revision required');if(typeof publish!=='boolean')V.fail('Publish must be boolean');
  return db.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(8102401)');await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,actor);
   // Unpublish remains available without schema/model prerequisites.
   let state;
   if(publish)state=await inspect(c,id,true);
   else {const product=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!product)fail(404,'Product not found');state={product,reasons:[]};}
   if(String(state.product.revision)!==String(expected))fail(409,'Product changed; reload before publication');
   if(publish&&state.reasons.length)fail(409,state.reasons.join('; '));
   const product=(await c.query('UPDATE products SET published=$2,updated_at=now() WHERE id=$1 RETURNING *',[id,publish])).rows[0];
   await c.query("INSERT INTO admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'products',$3,$4,$5)",[actor.id,publish?'publish':'unpublish',id,{published:state.product.published,revision:state.product.revision},{published:publish,revision:product.revision}]);
   return {product};
  });
 }
 return {readiness,set};
}
module.exports={corpusDigest,blockers,createPublicationService};
