"use strict";
const MAX_GROUP_SIZE=1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEWABLE=new Set(['draft','pending_audit','pending_review','approved']);
const ELIGIBLE_PRODUCT_SQL="p.review_status <> 'duplicate' AND p.duplicate_of_product_id IS NULL";
function fail(status,message){throw Object.assign(new Error(message),{status});}
function eligibleForDuplicateReview(product){
 return !!product&&product.review_status!=='duplicate'&&!product.duplicate_of_product_id;
}
function assertEligibleSubject(product){
 if(!eligibleForDuplicateReview(product))fail(409,'Confirmed duplicates cannot enter another review cycle; explicitly reverse the resolution first');
 if(!REVIEWABLE.has(product.review_status))fail(409,'Current product state does not permit duplicate review');
}
function validateGroupDecisions(products,decisions){
 if(!Array.isArray(products)||products.length<2||products.length>MAX_GROUP_SIZE)fail(400,'A review group must contain 2 to 1000 products');
 if(!Array.isArray(decisions)||decisions.length!==products.length)fail(400,'Record exactly one decision for every product in the group');
 const live=new Map();
 for(const product of products){
  if(!product||!UUID.test(product.id)||live.has(product.id))fail(400,'Invalid or repeated group product');
  assertEligibleSubject(product);live.set(product.id,product);
 }
 const selected=new Map();
 for(const item of decisions){
  if(!item||!live.has(item.product_id)||selected.has(item.product_id))fail(400,'Unknown or repeated product decision');
  const product=live.get(item.product_id);
  if(!/^[1-9][0-9]*$/.test(String(item.revision))||String(item.revision)!==String(product.revision))fail(409,'Product changed; reload the complete group before recording decisions');
  if(!['retain','duplicate'].includes(item.disposition))fail(400,'Every group product must be retained or assigned a duplicate target before final confirmation');
  if(item.disposition==='retain'&&item.duplicate_of_product_id!=null)fail(400,'A retained product cannot have a duplicate target');
  selected.set(item.product_id,item);
 }
 const targets=new Set();
 for(const item of selected.values()){
  if(item.disposition!=='duplicate')continue;
  const target=selected.get(item.duplicate_of_product_id);
  if(item.duplicate_of_product_id===item.product_id)fail(400,'A product cannot be a duplicate of itself');
  if(!target||target.disposition!=='retain')fail(400,'Every duplicate must point directly to a retained product in this group; chains and cycles are not allowed');
  targets.add(target.product_id);
 }
 return products.map(product=>{
  const item=selected.get(product.id),duplicate=item.disposition==='duplicate';
  return {
   product_id:product.id,
   revision:String(product.revision),
   decision:duplicate?'confirm_duplicate':targets.has(product.id)?'retain_primary':'approve_distinct',
   duplicate_of_product_id:duplicate?item.duplicate_of_product_id:null,
   deactivate:duplicate,
   unpublish:duplicate
  };
 });
}
module.exports={MAX_GROUP_SIZE,ELIGIBLE_PRODUCT_SQL,eligibleForDuplicateReview,assertEligibleSubject,validateGroupDecisions};
