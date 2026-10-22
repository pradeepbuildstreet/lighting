"use strict";
const {compatibilityPublicationWarnings}=require('./compatibility-publication-warnings');
const crypto=require('node:crypto'),V=require('../validators/catalogue');
const {visibilityByIds}=require('./catalogue-visibility');
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function corpusDigest(rows){return crypto.createHash('sha256').update(JSON.stringify(rows.map(p=>[p.id,String(p.revision),p.is_active]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');}
function blockers(product,facts){
 const reasons=[];
 if(!product.is_active)reasons.push('Product must be active');
 if(product.selling_price===null||product.selling_price===undefined||!Number.isFinite(Number(product.selling_price))||Number(product.selling_price)<0)reasons.push('Valid public selling price required');
 if(product.review_status!=='approved'||String(product.approved_revision)!==String(product.revision)||!product.approved_by)reasons.push('Current distinct approval required');
 if(product.duplicate_of_product_id)reasons.push('Duplicate products cannot be published');
 if(!facts.primaryCategory)reasons.push('Active primary category required');
 if(!facts.primaryImage)reasons.push('Primary image required');
 if(!facts.activeSpecType)reasons.push('Specifications and active fixture/light type required');
 const a=facts.audit,r=facts.review;
 if(!a||a.status!=='completed'||String(a.product_revision)!==String(product.revision))reasons.push('Latest completed audit must match the current revision');
 if(!r||r.decision!=='approve_distinct'||r.reviewer_id!==product.approved_by)reasons.push('Latest audit review must approve this product as distinct');
 // Corpus freshness is enforced before recording a review, not forever afterward.
 if(!a?.corpus_digest)reasons.push('Completed audit evidence required');
 return reasons;
}
function createPublicationService(db){
 async function inspect(c,id,locked=false){
  const product=(await c.query('SELECT * FROM products WHERE id=$1'+(locked?' FOR UPDATE':''),[id])).rows[0];if(!product)fail(404,'Product not found');
  const primaryCategory=(await c.query('SELECT c.id FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=$1 AND pc.is_primary AND c.is_active'+(locked?' FOR SHARE OF c':''),[id])).rows.length>0;
  const primaryImage=(await c.query("SELECT id FROM product_media WHERE product_id=$1 AND is_primary AND media_type='image'"+(locked?' FOR SHARE':''),[id])).rows.length>0;
  const type=product.product_kind==='fixture'?['fixture_specs','fixture_types','fixture_type_id']:['light_specs','light_types','light_type_id'];
  const activeSpecType=(await c.query(`SELECT t.id FROM ${type[0]} s JOIN ${type[1]} t ON t.id=s.${type[2]} WHERE s.product_id=$1 AND t.is_active`+(locked?' FOR SHARE OF t':''),[id])).rows.length>0;
  const audit=(await c.query('SELECT * FROM product_duplicate_audits WHERE product_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[id])).rows[0];
  const review=audit?(await c.query('SELECT * FROM product_duplicate_reviews WHERE audit_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[audit.id])).rows[0]:null;
  const facts={primaryCategory,primaryImage,activeSpecType,audit,review};
  const reasons=blockers(product,facts);
  return {product,reasons,can_publish:reasons.length===0};
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
   await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,actor);
   // Unpublish remains available without prerequisites; it is never approval.
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
