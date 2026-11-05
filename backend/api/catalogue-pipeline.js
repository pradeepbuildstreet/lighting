"use strict";
const V=require('../validators/catalogue');
const groups={identity:'SKU assignment|Product name',selling_price:'selling price',dealer_attachment:'dealer attachment',dealer_pricing:'dealer pric',catalogue_data:'category|hierarchy|image|tag-model|model|reference|cutover|prerequisite|Publication validation rejected',duplicate_audit:'duplicate audit|tags-evidence|Automated audit',duplicate_review:'approval|distinct|Confirmed duplicate|review state'};
const keys=Object.keys(groups);
function filters(q={}){const page=Number(q.page||1),check=String(q.check||''),active=String(q.active||''),release=String(q.release||'');if(!Number.isSafeInteger(page)||page<1||page>100000||check&&!keys.includes(check)||!['','true','false'].includes(active)||!['','activation_ready','inactive_blocked'].includes(release))throw Object.assign(new Error('Invalid pipeline filter'),{status:400});return {page,check,active,release,q:String(q.q||'').trim().slice(0,200)};}
const expressions=keys.map(k=>`'${k}',CASE ${k==='duplicate_audit'?"WHEN job_status IN ('pending','processing') THEN 'processing' ":''}WHEN assessed_at IS NULL OR assessed_revision<>revision THEN 'not_assessed' WHEN EXISTS(SELECT 1 FROM unnest(reasons) message WHERE message ~* '${groups[k]}') THEN 'action_required' ELSE 'passed' END`).join(',');
const base=`WITH items AS (
 SELECT p.id,p.sku,p.model_number,p.name,p.currency,p.selling_price,p.revision,p.published,p.is_active,md5(to_jsonb(p)::text) AS edit_token,
 s.customer_visible,s.assessed_at,s.assessed_revision,j.status AS job_status,
 COALESCE(p.published AND NOT p.is_active AND p.review_status='approved' AND p.approved_revision=p.revision AND p.approved_by IS NOT NULL AND p.duplicate_of_product_id IS NULL AND readiness.ready AND readiness.assessed_revision=p.revision AND public.catalogue_saleability_ready(p.id,p.currency),false) AS activation_ready,
 s.reasons||CASE WHEN j.status IN ('held','failed','actor_required') AND j.last_error IS NOT NULL THEN ARRAY['Automated audit: '||j.last_error] ELSE '{}'::text[] END AS reasons
 FROM public.catalogue_pipeline_status s JOIN public.products p ON p.id=s.id
 LEFT JOIN public.catalogue_product_readiness readiness ON readiness.product_id=p.id
 LEFT JOIN public.catalogue_duplicate_jobs j ON j.product_id=p.id AND j.product_revision=p.revision
 WHERE ($1='' OR p.sku ILIKE '%'||$1||'%' OR p.name ILIKE '%'||$1||'%' OR p.model_number ILIKE '%'||$1||'%') AND ($2='' OR p.is_active=($2='true')) AND ($3::uuid IS NULL OR p.id=$3)
), facts AS (SELECT items.*,jsonb_build_object(${expressions}) AS checks FROM items)`;
const releaseWhere=" WHERE ($4='' OR checks->>$4<>'passed') AND ($5='' OR ($5='activation_ready' AND activation_ready) OR ($5='inactive_blocked' AND NOT is_active AND NOT activation_ready))";
function createPipelineRouter(express,db){const router=express.Router();
 const route=fn=>async(req,res)=>{res.set('Cache-Control','private, no-store');try{if(!req.admin?.id)return res.status(401).json({error:'Admin sign-in required'});await fn(req,res);}catch(e){const status=[400,403,404,409,503].includes(e.status)?e.status:503;res.status(status).json({error:e.status?e.message:'Pipeline unavailable; reload current state before repeating a write'});}};
 async function ready(c){if((await c.query("SELECT to_regclass('public.catalogue_pipeline_status') IS NOT NULL AND to_regclass('public.catalogue_duplicate_jobs') IS NOT NULL AS ready")).rows[0]?.ready!==true)throw Object.assign(new Error('The combined pipeline migration is not installed. No pipeline action was performed.'),{status:503});}
 router.get('/products',route(async(req,res)=>{
  const f=filters(req.query),args=[f.q,f.active,null];
  const data=await db.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await ready(c);
   const summary=(await c.query(base+` SELECT count(*)::int AS total,count(*) FILTER(WHERE customer_visible)::int AS visible,${keys.map(k=>`count(*) FILTER(WHERE checks->>'${k}'<>'passed')::int AS ${k}`).join(',')} FROM facts`,args)).rows[0];
   const releaseSummary=(await c.query(base+" SELECT count(*) FILTER(WHERE activation_ready)::int AS activation_ready,count(*) FILTER(WHERE NOT is_active AND NOT activation_ready)::int AS inactive_blocked FROM facts",['','',null])).rows[0];
   const scoped=[...args,f.check,f.release];
   const total=(await c.query(base+' SELECT count(*)::int AS total FROM facts'+releaseWhere,scoped)).rows[0].total;
   const products=(await c.query(base+' SELECT * FROM facts'+releaseWhere+' ORDER BY sku NULLS LAST,id LIMIT 50 OFFSET $6',[...scoped,(f.page-1)*50])).rows;
   const enabled=(await c.query('SELECT enabled FROM public.catalogue_pipeline_configuration WHERE singleton')).rows[0]?.enabled===true;
   return {products,summary:{...summary,...releaseSummary},worker_enabled:enabled,activation_views_ready:true,pagination:{page:f.page,pages:Math.ceil(total/50),total}};
  });res.json(data);
 }));
 router.get('/products/:id',route(async(req,res)=>{const id=V.uuid(req.params.id);await ready(db);const product=(await db.query(base+' SELECT * FROM facts',['','',id])).rows[0];if(!product)throw Object.assign(new Error('Product not found'),{status:404});res.json({products:[product],activation_views_ready:true,summary:{total:1,visible:product.customer_visible?1:0},pagination:{page:1,pages:1,total:1},worker_enabled:(await db.query('SELECT enabled FROM public.catalogue_pipeline_configuration WHERE singleton')).rows[0]?.enabled===true});}));
 router.post('/products/:id/reassess',route(async(req,res)=>{const id=V.uuid(req.params.id),revision=String(req.body?.revision||'');if(!/^[1-9]\d{0,18}$/.test(revision))throw Object.assign(new Error('Expected revision required'),{status:400});await db.transaction(async c=>{await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='30s'");await c.query('SELECT pg_advisory_xact_lock(8102401)');await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,req.admin);await ready(c);const p=(await c.query('SELECT revision FROM public.products WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw Object.assign(new Error('Product not found'),{status:404});if(String(p.revision)!==revision)throw Object.assign(new Error('Product changed; reload before reassessment'),{status:409});await c.query('SELECT public.catalogue_reassess_product($1)',[id]);});res.json({product:(await db.query(base+' SELECT * FROM facts',['','',id])).rows[0]});}));
 return router;}
module.exports={createPipelineRouter,filters,keys};
