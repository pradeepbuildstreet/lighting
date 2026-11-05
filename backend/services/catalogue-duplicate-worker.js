"use strict";
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
 async function routeAudit(job,auditId,autoApprove){
  if(!autoApprove){await finish(job,'awaiting_review',null,auditId);return;}
  const result=await service.detail(auditId);
  if(result.reviews.length){await finish(job,'awaiting_review',null,auditId);return;}
  if(result.candidates.length){await finish(job,'awaiting_review',null,auditId);return;}
  await service.review({id:job.actor_id},auditId,'approve_distinct',null,null,{automated:true});
  await finish(job,'completed',null,auditId);
  log({event:'duplicate_clean_audit_approved',product_id:job.product_id,audit_id:auditId});
 }
 async function cycle(){
  if(stopped)return;
  const installed=(await db.query("SELECT to_regclass('public.catalogue_pipeline_configuration') IS NOT NULL AND to_regclass('public.catalogue_duplicate_jobs') IS NOT NULL AS ready")).rows[0]?.ready===true;
  if(!installed)return;
  const configuration=(await db.query("SELECT enabled,COALESCE((to_jsonb(c)->>'auto_approve_clean_audits')::boolean,false) AS auto_approve_clean_audits FROM public.catalogue_pipeline_configuration c WHERE singleton")).rows[0];
  if(configuration?.enabled!==true)return;
  await db.query("UPDATE public.catalogue_duplicate_jobs SET status='failed',last_error='Lease expired after maximum attempts; administrator recheck required',lease_until=NULL,lease_token=NULL,updated_at=now() WHERE status='processing' AND lease_until<now() AND attempts>=5");
  const job=await db.transaction(async c=>(await c.query(`WITH due AS (
   SELECT product_id FROM public.catalogue_duplicate_jobs
   WHERE attempts<5 AND actor_id IS NOT NULL AND run_after<=now() AND (status='pending' OR (status='processing' AND lease_until<now()))
   AND (lease_until IS NULL OR lease_until<now()) ORDER BY run_after,product_id FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE public.catalogue_duplicate_jobs j SET status='processing',attempts=j.attempts+1,
   lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid(),updated_at=now()
   FROM due WHERE j.product_id=due.product_id RETURNING j.*`)).rows[0]);
  if(!job)return;
  try{
   const current=(await db.query(`SELECT p.revision,p.review_status,a.id AS audit_id,a.status AS audit_status,a.product_revision,a.algorithm_version,a.corpus_digest
    FROM public.products p LEFT JOIN LATERAL(SELECT * FROM public.product_duplicate_audits WHERE product_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1)a ON true WHERE p.id=$1`,[job.product_id])).rows[0];
   if(!current||['duplicate','rejected','archived'].includes(current.review_status)){await finish(job,'held','Current product state does not permit automatic auditing.');return;}
   if(current.audit_status==='completed'&&String(current.product_revision)===String(current.revision)&&String(current.revision)===String(job.product_revision)&&current.algorithm_version==='tags-evidence-v2'&&current.corpus_digest){await routeAudit(job,current.audit_id,configuration.auto_approve_clean_audits);return;}
   const result=await service.run({id:job.actor_id},job.product_id,String(job.product_revision));
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
