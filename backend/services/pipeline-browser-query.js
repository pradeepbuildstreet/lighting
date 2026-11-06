"use strict";
const groups={identity:'SKU assignment|Product name',selling_price:'selling price',dealer_attachment:'dealer attachment',dealer_pricing:'dealer pric',catalogue_data:'category|hierarchy|image|tag-model|model|reference|cutover|prerequisite|Publication validation rejected',duplicate_audit:'duplicate audit|tags-evidence|Automated audit',duplicate_review:'approval|distinct|Confirmed duplicate|review state'};
const keys=Object.keys(groups);
const expressions=keys.map(k=>`'${k}',CASE ${k==='duplicate_audit'?"WHEN job_status IN ('pending','processing') THEN 'processing' ":''}WHEN assessed_at IS NULL OR assessed_revision<>revision THEN 'not_assessed' WHEN EXISTS(SELECT 1 FROM unnest(reasons) message WHERE message ~* '${groups[k]}') THEN 'action_required' ELSE 'passed' END`).join(',');
function makeBase(where,prefix=''){return `${prefix?prefix.trim()+', ':'WITH '}items AS (
 SELECT p.id,p.sku,p.model_number,p.name,p.currency,p.selling_price,p.default_discount_percent,p.product_kind,p.brand,p.revision,p.published,p.is_active,md5(to_jsonb(p)::text) AS edit_token,
 s.customer_visible,s.assessed_at,s.assessed_revision,j.status AS job_status,
 COALESCE(p.published AND NOT p.is_active AND p.review_status='approved' AND p.approved_revision=p.revision AND p.approved_by IS NOT NULL AND p.duplicate_of_product_id IS NULL AND readiness.ready AND readiness.assessed_revision=p.revision AND public.catalogue_saleability_ready(p.id,p.currency),false) AS activation_ready,
 s.reasons||CASE WHEN j.status IN ('held','failed','actor_required') AND j.last_error IS NOT NULL THEN ARRAY['Automated audit: '||j.last_error] ELSE '{}'::text[] END AS reasons
 FROM public.catalogue_pipeline_status s JOIN public.products p ON p.id=s.id
 LEFT JOIN public.catalogue_product_readiness readiness ON readiness.product_id=p.id
 LEFT JOIN public.catalogue_duplicate_jobs j ON j.product_id=p.id AND j.product_revision=p.revision
 WHERE ${where}
), facts AS (SELECT items.*,jsonb_build_object(${expressions}) AS checks FROM items)`;}
function buildBrowserQuery(input,core=require('./admin-product-browser-core')){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Invalid pipeline browser criteria'),{status:400});
 const {pipeline_check='',pipeline_release='',...common}=input;
 if(typeof pipeline_check!=='string'||pipeline_check&&!keys.includes(pipeline_check)||typeof pipeline_release!=='string'||!['','activation_ready','inactive_blocked'].includes(pipeline_release))throw Object.assign(Error('Invalid pipeline validation or activation view'),{status:400});
 const filters=core.normalise(common),scope=core.buildWhere(filters),n=scope.values.length,cte=makeBase(scope.where,scope.prefix),check='$'+(n+1)+'::text',release='$'+(n+2)+'::text';
 const where=` WHERE (${check}='' OR checks->>${check}<>'passed') AND (${release}='' OR (${release}='activation_ready' AND activation_ready) OR (${release}='inactive_blocked' AND NOT is_active AND NOT activation_ready))`;
 const args=[...scope.values,pipeline_check,pipeline_release];
 return {filters,pipeline_check,pipeline_release,cte,summaryArgs:scope.values,countSql:cte+' SELECT count(*)::int AS total FROM facts'+where,countArgs:args,pageSql:cte+' SELECT * FROM facts'+where+' ORDER BY sku NULLS LAST,id LIMIT $'+(n+3)+'::integer OFFSET $'+(n+4)+'::integer',pageArgs:[...args,filters.limit,(filters.page-1)*filters.limit]};
}
module.exports={groups,keys,makeBase,buildBrowserQuery};
