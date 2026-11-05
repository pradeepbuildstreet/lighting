"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {TAG_ALGORITHM,EVIDENCE_FORMAT,tagDigest}=require('./catalogue-duplicate-model');
const {FRESHNESS_ERROR,canResumeFreshAudit}=require('./catalogue-audit-recovery-policy');
const {createDuplicateWorker}=require('./catalogue-duplicate-worker');
const product=()=>({id:'p',revision:7,is_active:false,product_kind:'light',name:'Ring light',brand:'Clara',model_number:'CD-Y1601-GD',review_status:'pending_review',duplicate_of_product_id:null,attributes:{product_kind_id:'k',wattage:10},tags:[{id:'tag',tag_group_id:'group',is_active:true,group_active:true}],image_hashes:['a'.repeat(64)]});
const rows=()=>[product(),{...product(),id:'other',model_number:'OTHER'}];
test('routine review transitions do not invalidate subject or unrelated evidence',()=>{const baseline=tagDigest(rows());for(const status of ['draft','pending_audit','pending_review','approved'])for(const index of [0,1]){const data=rows();data[index].review_status=status;assert.equal(tagDigest(data),baseline);}});
test('approval metadata and published flag are not matching evidence',()=>{const data=rows();data[1]={...data[1],published:true,approved_by:'admin',approved_at:'now',approved_revision:7};assert.equal(tagDigest(data),tagDigest(rows()));});
test('terminal states and unknown state changes invalidate evidence',()=>{for(const status of ['duplicate','rejected','archived','unknown']){const data=rows();data[1].review_status=status;assert.notEqual(tagDigest(data),tagDigest(rows()));}});
test('all matching and eligibility inputs remain protected',()=>{for(const patch of [{revision:8},{name:'Changed'},{brand:'Other'},{model_number:'New'},{is_active:true},{product_kind:'fixture'},{duplicate_of_product_id:'target'},{attributes:{product_kind_id:'k',wattage:20}},{tags:[]},{image_hashes:['b'.repeat(64)]}]){const data=rows();data[1]={...data[1],...patch};assert.notEqual(tagDigest(data),tagDigest(rows()),JSON.stringify(patch));}});
test('catalogue additions and deletions invalidate evidence',()=>{assert.notEqual(tagDigest(rows()),tagDigest([product()]));assert.notEqual(tagDigest(rows()),tagDigest([...rows(),{...product(),id:'third'}]));});
test('deterministic ordering preserves equivalent snapshots',()=>{const data=rows();data.reverse();assert.equal(tagDigest(data),tagDigest(rows()));});
test('scoring algorithm stays unchanged and fingerprint format is explicit',()=>{assert.equal(TAG_ALGORITHM,'tags-evidence-v2');assert.equal(EVIDENCE_FORMAT,'tags-evidence-corpus-v3');});
test('legacy fingerprint is not silently accepted',()=>{const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;const snapshot=rows().map(p=>({id:p.id,revision:String(p.revision),is_active:p.is_active,product_kind:p.product_kind,name:p.name,brand:p.brand,model_number:p.model_number,duplicate_of_product_id:p.duplicate_of_product_id||null,review_status:p.review_status,attributes:p.attributes||null,tags:[...(p.tags||[])].sort((a,b)=>a.id.localeCompare(b.id)),image_hashes:[...new Set(p.image_hashes||[])].sort()})).sort((a,b)=>a.id.localeCompare(b.id));const legacy=crypto.createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex');assert.notEqual(tagDigest(rows()),legacy);});
const eligible=()=>({product_id:'p',status:'held',last_error:FRESHNESS_ERROR,generation:2,product_revision:7,actor_id:'admin',actor_role:'admin',actor_active:'true',live_revision:7,live_review_status:'pending_review',live_duplicate_of_product_id:null,live_sku:'INL100062',live_name:'Ring light',latest_audit_id:'fresh',audit_status:'completed',algorithm_version:'tags-evidence-v2',audited_revision:7,has_corpus_digest:true,has_review:false,updated_at:'2026-11-05T12:44:50Z',audit_completed_at:'2026-11-05T12:50:19Z',lease_until:null,catalogue_count:64,scanned_count:63,candidate_count:0});
test('newer complete audit can resume a freshness-held job',()=>assert.equal(canResumeFreshAudit(eligible()),true));
test('fresh audit with candidates is resumed only for normal manual routing',()=>assert.equal(canResumeFreshAudit({...eligible(),candidate_count:2}),true));
test('same or older audit cannot repeatedly reset retries',()=>{for(const audit_completed_at of ['2026-11-05T12:44:50Z','2026-11-05T12:40:00Z',null,'bad'])assert.equal(canResumeFreshAudit({...eligible(),audit_completed_at}),false);});
test('manual decisions and correction states cannot be overwritten',()=>{assert.equal(canResumeFreshAudit({...eligible(),has_review:true}),false);for(const live_review_status of ['draft','approved','duplicate','rejected','archived'])assert.equal(canResumeFreshAudit({...eligible(),live_review_status}),false);assert.equal(canResumeFreshAudit({...eligible(),live_duplicate_of_product_id:'target'}),false);});
test('revision, incomplete-scan and algorithm mismatches remain held',()=>{for(const patch of [{live_revision:8},{audited_revision:8},{audit_status:'running'},{algorithm_version:'old'},{has_corpus_digest:false},{catalogue_count:1001},{scanned_count:62},{scanned_count:null},{candidate_count:null},{candidate_count:-1},{live_sku:null},{live_name:''}])assert.equal(canResumeFreshAudit({...eligible(),...patch}),false,JSON.stringify(patch));});
test('revoked actor and active leases remain protected',()=>{for(const patch of [{actor_active:false},{actor_role:'dealer'},{actor_id:null},{lease_until:'2099-01-01T00:00:00Z'},{lease_until:'invalid'}])assert.equal(canResumeFreshAudit({...eligible(),...patch}),false);});
test('unrelated failures and active jobs are never auto-resumed',()=>{for(const patch of [{status:'processing'},{status:'pending'},{status:'failed'},{last_error:'Product changed; reload'}])assert.equal(canResumeFreshAudit({...eligible(),...patch}),false);});
function fixture({row=eligible(),enabled=true,auto=true,recoveryEnabled=true,candidates=[],reviews=[],reviewError=null}={}){
 const statuses=[],calls=[],events=[],queries=[];let pending=false;
 const query=async(sql,args)=>{
  queries.push(sql);
  if(sql.includes('to_regclass'))return {rows:[{ready:true}]};
  if(sql.startsWith('SELECT enabled AND'))return {rows:[{enabled:recoveryEnabled}]};
  if(sql.startsWith('SELECT enabled,'))return {rows:[{enabled,auto_approve_clean_audits:auto}]};
  if(sql.startsWith('SELECT j.*'))return {rows:[row]};
  if(sql.includes("SET status='pending',generation")){pending=true;calls.push(['resume',args]);return {rows:[{product_id:'p',generation:3,audit_id:'fresh'}]};}
  if(sql.startsWith('WITH due'))return {rows:pending?[{product_id:'p',product_revision:7,actor_id:'admin',generation:3,lease_token:'lease',attempts:1}]:[]};
  if(sql.includes('SELECT p.revision'))return {rows:[{revision:7,review_status:'pending_review',audit_id:'fresh',audit_status:'completed',product_revision:7,algorithm_version:'tags-evidence-v2',corpus_digest:'digest'}]};
  if(sql.includes('SET status=$4'))statuses.push(args[3]);
  return {rows:[]};
 };
 const service={detail:async()=>({candidates,reviews}),review:async()=>{calls.push(['approve']);if(reviewError)throw reviewError;},run:async()=>{calls.push(['rescan']);return {audit:{id:'new'}};}};
 const db={query,transaction:async fn=>fn({query})};
 return {calls,statuses,queries,events,worker:createDuplicateWorker(db,{duplicateFactory:()=>service,log:e=>events.push(e)})};
}
test('recovered clean audit enters existing approval path',async()=>{const f=fixture();await f.worker.tick();assert.deepEqual(f.calls.map(c=>c[0]),['resume','approve']);assert.deepEqual(f.statuses,['completed']);assert.equal(f.events.some(e=>e.event==='duplicate_job_resumed_after_fresh_audit'),true);});
test('recovered candidate audit goes to manual review without approval',async()=>{const f=fixture({row:{...eligible(),candidate_count:2},candidates:[{},{}]});await f.worker.tick();assert.deepEqual(f.calls.map(c=>c[0]),['resume']);assert.deepEqual(f.statuses,['awaiting_review']);});
test('recorded manual decision prevents even a queue reset',async()=>{const f=fixture({row:{...eligible(),has_review:true}});await f.worker.tick();assert.deepEqual(f.calls,[]);});
test('disabled automatic approval prevents recovery',async()=>{const f=fixture({auto:false});await f.worker.tick();assert.deepEqual(f.calls,[]);assert.equal(f.queries.some(s=>s.startsWith('SELECT j.*')),false);});
test('configuration disabled during recovery is respected',async()=>{const f=fixture({recoveryEnabled:false});await f.worker.tick();assert.deepEqual(f.calls,[]);});
test('disabled worker does not perform recovery',async()=>{const f=fixture({enabled:false});await f.worker.tick();assert.deepEqual(f.calls,[]);});
test('recovery query is bounded and update uses generation/time CAS',async()=>{const f=fixture();await f.worker.tick();assert.equal(f.queries.some(s=>s.includes('LIMIT 5 FOR UPDATE OF j SKIP LOCKED')),true);assert.equal(f.queries.some(s=>s.includes('generation=$2 AND updated_at=$3')),true);assert.equal(f.calls[0][1][3],'fresh');});
test('candidate freshness failure is still bounded to one rescan',async()=>{const f=fixture({reviewError:Object.assign(Error(FRESHNESS_ERROR),{status:409})});await f.worker.tick();assert.equal(f.calls.filter(c=>c[0]==='rescan').length,1);assert.deepEqual(f.statuses,['held']);});
