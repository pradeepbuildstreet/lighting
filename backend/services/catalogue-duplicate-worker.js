"use strict";
const {FRESHNESS_ERROR,canResumeFreshAudit}=require('./catalogue-audit-recovery-policy');
function leaseFor(job){
 for(const value of [job.product_revision,job.generation])if(typeof value==='number'&&!Number.isSafeInteger(value))throw Object.assign(new Error('Exact numeric worker job identity required'),{status:409,code:'DUPLICATE_JOB_LEASE_LOST'});
 return Object.freeze({product_id:job.product_id,product_revision:String(job.product_revision),actor_id:job.actor_id,generation:String(job.generation),lease_token:job.lease_token});
}
function createDuplicateWorker(db,{duplicateFactory,intervalMs=10000,log=()=>{}}={}){
 let stopped=false,running=null,timer=null;
 const scoped={...db,transaction:fn=>db.transaction(async c=>{await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='30s'");return fn(c);})};
 const service=(duplicateFactory||require('./catalogue-duplicates').createDuplicateService)(scoped);
 async function finish(job,status,error=null,auditId=null){
  await db.transaction(async c=>{
   await c.query(`UPDATE public.catalogue_duplicate_jobs SET status=$4,last_error=$5,audit_id=$6,lease_until=NULL,lease_token=NULL,
    run_after=CASE WHEN $4='pending' THEN now()+make_interval(secs=>LEAST(300,attempts*30)) ELSE run_after END,updated_at=now()
    WHERE product_id=$1 AND generation=$2 AND lease_token=$3`,[job.product_id,job.generation,job.lease_token,status,error,auditId]);
   await c.query(`UPDATE public.catalogue_duplicate_jobs SET lease_until=NULL,lease_token=NULL,updated_at=now()
    WHERE product_id=$1 AND generation<>$2 AND lease_token=$3`,[job.product_id,job.generation,job.lease_token]);
  });
 }
 async function routeAudit(job,auditId,autoApprove,canRefresh=true){
  if(!autoApprove){await finish(job,'awaiting_review',null,auditId);return;}
  const result=await service.detail(auditId);
  if(result.reviews.length){await finish(job,'awaiting_review',null,auditId);return;}
  if(result.candidates.length){await finish(job,'awaiting_review',null,auditId);return;}
  try{
   await service.review({id:job.actor_id},auditId,'approve_distinct',null,null,{automated:true,jobLease:leaseFor(job)});
  }catch(e){
   if(!canRefresh||e.status!==409||e.message!=='Catalogue evidence changed; rerun the audit')throw e;
   const fresh=await service.run({id:job.actor_id},job.product_id,String(job.product_revision),{refreshAuditId:auditId,jobLease:leaseFor(job)});
   log({event:'duplicate_stale_audit_refreshed',product_id:job.product_id,previous_audit_id:auditId,audit_id:fresh.audit.id});
   await routeAudit(job,fresh.audit.id,autoApprove,false);
   return;
  }
  await finish(job,'completed',null,auditId);
  log({event:'duplicate_clean_audit_approved',product_id:job.product_id,audit_id:auditId});
 }
 async function resumeFreshHeldAudits(){
  const recovered=await db.transaction(async c=>{
   await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='15s'");
   await c.query('SELECT pg_advisory_xact_lock(8102401)');await c.query('SELECT pg_advisory_xact_lock(8102403)');
   if((await c.query("SELECT enabled AND COALESCE((to_jsonb(c)->>'auto_approve_clean_audits')::boolean,false) AS enabled FROM public.catalogue_pipeline_configuration c WHERE singleton FOR SHARE")).rows[0]?.enabled!==true)return [];
   const rows=(await c.query(`SELECT j.*,j.updated_at::text AS recovery_updated_at,p.revision AS live_revision,p.review_status AS live_review_status,
    p.duplicate_of_product_id AS live_duplicate_of_product_id,p.sku AS live_sku,p.name AS live_name,
    to_jsonb(u)->>'role' AS actor_role,to_jsonb(u)->>'is_active' AS actor_active,
    a.id AS latest_audit_id,a.status AS audit_status,a.algorithm_version,a.product_revision AS audited_revision,
    a.completed_at AS audit_completed_at,a.scanned_count,a.corpus_digest IS NOT NULL AS has_corpus_digest,
    (SELECT count(*)::int FROM public.products) AS catalogue_count,
    (SELECT count(*)::int FROM public.product_duplicate_candidates x WHERE x.audit_id=a.id) AS candidate_count,
    EXISTS(SELECT 1 FROM public.product_duplicate_reviews x WHERE x.audit_id=a.id) AS has_review
    FROM public.catalogue_duplicate_jobs j JOIN public.products p ON p.id=j.product_id
    JOIN public.app_users u ON u.id=j.actor_id
    JOIN LATERAL(SELECT * FROM public.product_duplicate_audits d WHERE d.product_id=p.id ORDER BY d.created_at DESC,d.id DESC LIMIT 1)a ON true
    WHERE j.status='held' AND j.last_error=$1 AND (j.lease_until IS NULL OR j.lease_until<now())
    AND p.review_status='pending_review' AND p.duplicate_of_product_id IS NULL
    AND p.sku IS NOT NULL AND length(btrim(coalesce(p.name,'')))>0 AND j.product_revision=p.revision
    AND to_jsonb(u)->>'role'='admin' AND to_jsonb(u)->>'is_active'='true'
    AND a.status='completed' AND a.product_revision=p.revision AND a.algorithm_version='tags-evidence-v2'
    AND a.corpus_digest IS NOT NULL AND a.completed_at>j.updated_at
    AND a.scanned_count=(SELECT count(*)-1 FROM public.products) AND (SELECT count(*) FROM public.products)<=1000
    AND NOT EXISTS(SELECT 1 FROM public.product_duplicate_reviews x WHERE x.audit_id=a.id)
    ORDER BY a.completed_at,j.product_id LIMIT 5 FOR UPDATE OF j SKIP LOCKED`,[FRESHNESS_ERROR])).rows;
   const saved=[];
   for(const row of rows){
    if(!canResumeFreshAudit(row)||typeof row.recovery_updated_at!=='string'||!row.recovery_updated_at)continue;
    const next=(await c.query(`UPDATE public.catalogue_duplicate_jobs SET status='pending',generation=generation+1,attempts=0,
     run_after=clock_timestamp(),lease_until=NULL,lease_token=NULL,last_error=NULL,audit_id=$4,updated_at=clock_timestamp()
     WHERE product_id=$1 AND generation=$2 AND updated_at=$3::timestamptz AND status='held'
     RETURNING product_id,generation,audit_id`,[row.product_id,row.generation,row.recovery_updated_at,row.latest_audit_id])).rows[0];
    if(next)saved.push(next);else log({event:'duplicate_recovery_compare_conflict',product_id:row.product_id,generation:row.generation});
   }
   return saved;
  });
  for(const row of recovered)log({event:'duplicate_job_resumed_after_fresh_audit',...row});
 }
 async function cycle(){
  if(stopped)return;
  const installed=(await db.query("SELECT to_regclass('public.catalogue_pipeline_configuration') IS NOT NULL AND to_regclass('public.catalogue_duplicate_jobs') IS NOT NULL AS ready")).rows[0]?.ready===true;
  if(!installed)return;
  const configuration=(await db.query("SELECT enabled,COALESCE((to_jsonb(c)->>'auto_approve_clean_audits')::boolean,false) AS auto_approve_clean_audits FROM public.catalogue_pipeline_configuration c WHERE singleton")).rows[0];
  if(configuration?.enabled!==true)return;
  if(configuration.auto_approve_clean_audits===true)await resumeFreshHeldAudits();
  await db.query("UPDATE public.catalogue_duplicate_jobs SET status='failed',last_error='Lease expired after maximum attempts; administrator recheck required',lease_until=NULL,lease_token=NULL,updated_at=now() WHERE status='processing' AND lease_until<now() AND attempts>=5");
  const job=await db.transaction(async c=>(await c.query(`WITH due AS (
   SELECT q.product_id FROM public.catalogue_duplicate_jobs q
   WHERE q.attempts<5 AND q.actor_id IS NOT NULL AND q.run_after<=now() AND (q.status='pending' OR (q.status='processing' AND q.lease_until<now()))
   AND (q.lease_until IS NULL OR q.lease_until<now())
   AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=q.product_id
    AND p.review_status NOT IN ('duplicate','rejected','archived') AND p.duplicate_of_product_id IS NULL)
   ORDER BY q.run_after,q.product_id FOR UPDATE OF q SKIP LOCKED LIMIT 1
  ) UPDATE public.catalogue_duplicate_jobs j SET status='processing',attempts=j.attempts+1,
   lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid(),updated_at=now()
   FROM due WHERE j.product_id=due.product_id RETURNING j.*`)).rows[0]);
  if(!job)return;
  try{
   const current=(await db.query(`SELECT p.revision,p.review_status,p.duplicate_of_product_id,a.id AS audit_id,a.status AS audit_status,a.product_revision,a.algorithm_version,a.corpus_digest
    FROM public.products p LEFT JOIN LATERAL(SELECT * FROM public.product_duplicate_audits WHERE product_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1)a ON true WHERE p.id=$1`,[job.product_id])).rows[0];
   if(!current||current.duplicate_of_product_id||['duplicate','rejected','archived'].includes(current.review_status)){await finish(job,'held','Current product state does not permit automatic auditing.');return;}
   if(current.audit_status==='completed'&&String(current.product_revision)===String(current.revision)&&String(current.revision)===String(job.product_revision)&&current.algorithm_version==='tags-evidence-v2'&&current.corpus_digest){await routeAudit(job,current.audit_id,configuration.auto_approve_clean_audits);return;}
   const result=await service.run({id:job.actor_id},job.product_id,String(job.product_revision),{jobLease:leaseFor(job)});
   await routeAudit(job,result.audit.id,configuration.auto_approve_clean_audits);
   log({event:'duplicate_job_completed',product_id:job.product_id});
  }catch(e){
   const permission=e.status===401||e.status===403;
   const held=[400,404,409].includes(e.status);
   const status=permission?'actor_required':held?'held':job.attempts<5?'pending':'failed';
   const message=permission?'The originating administrator is no longer eligible. An active administrator must recheck this product.':held?e.message:'Automatic audit could not complete. Retry is bounded; inspect the job and recheck the product.';
   await finish(job,status,message);
   log({event:'duplicate_job_held',product_id:job.product_id,status,code:e.code||e.status||'UNAVAILABLE'});
  }
 }
 function tick(){if(stopped||running)return running;running=cycle().catch(e=>log({event:'duplicate_worker_unavailable',code:e.code||'UNAVAILABLE'})).finally(()=>{running=null;});return running;}
 function start(){if(!timer&&!stopped){timer=setInterval(tick,intervalMs);timer.unref?.();}return api;}
 async function stop(){stopped=true;if(timer)clearInterval(timer);timer=null;if(running)await running;}
 const api={tick,start,stop};return api;
}
module.exports={createDuplicateWorker};
