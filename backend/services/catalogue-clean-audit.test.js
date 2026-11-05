"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {assertCleanAudit}=require('./catalogue-clean-audit-policy');
const {createDuplicateWorker}=require('./catalogue-duplicate-worker');
const state=()=>({audit:{id:'a',product_id:'p',status:'completed',algorithm_version:'tags-evidence-v2',corpus_digest:'digest',product_revision:'2',scanned_count:2},product:{id:'p',revision:'2',review_status:'pending_review',duplicate_of_product_id:null},recordCount:3,candidateCount:0});
test('complete clean audit qualifies',()=>assert.doesNotThrow(()=>assertCleanAudit(state())));
test('any candidate requires manual review',()=>{for(const count of [1,20,undefined,NaN])assert.throws(()=>assertCleanAudit({...state(),candidateCount:count}),/manual review/);});
test('partial, missing, oversized or miscounted scans never auto-pass',()=>{for(const recordCount of [0,1001,2])assert.throws(()=>assertCleanAudit({...state(),recordCount}));for(const scanned_count of [null,undefined,0,1])assert.throws(()=>assertCleanAudit({...state(),audit:{...state().audit,scanned_count}}));});
test('stale or incomplete audit never auto-passes',()=>{for(const patch of [{status:'running'},{product_revision:'1'},{algorithm_version:'old'},{corpus_digest:null},{product_id:'other'}])assert.throws(()=>assertCleanAudit({...state(),audit:{...state().audit,...patch}}));});
test('manual correction, rejection, duplication or prior approval is respected',()=>{for(const review_status of ['draft','duplicate','rejected','archived','approved'])assert.throws(()=>assertCleanAudit({...state(),product:{...state().product,review_status}}));assert.throws(()=>assertCleanAudit({...state(),product:{...state().product,duplicate_of_product_id:'other'}}));});
function fixture({candidates=[],reviews=[],enabled=true,auto=true,reused=false,reviewError=null}={}){
 const calls=[],statuses=[],job={product_id:'p',product_revision:'2',actor_id:'admin',generation:1,lease_token:'lease',attempts:1};
 const service={run:async()=>{calls.push('run');return {audit:{id:'a'}};},detail:async()=>({audit:state().audit,candidates,reviews}),review:async(...args)=>{calls.push(args);if(reviewError)throw reviewError;}};
 const query=async(sql,args)=>{
  if(sql.includes('to_regclass'))return {rows:[{ready:true}]};
  if(sql.startsWith('SELECT enabled'))return {rows:[{enabled,auto_approve_clean_audits:auto}]};
  if(sql.startsWith('WITH due'))return {rows:[job]};
  if(sql.includes('SELECT p.revision'))return {rows:[{revision:'2',review_status:'pending_review',...(reused?{audit_id:'a',audit_status:'completed',product_revision:'2',algorithm_version:'tags-evidence-v2',corpus_digest:'digest'}:{})}]};
  if(sql.includes('SET status=$4'))statuses.push(args[3]);
  return {rows:[]};
 };
 const db={query,transaction:async fn=>fn({query})};
 return {worker:createDuplicateWorker(db,{duplicateFactory:()=>service}),calls,statuses};
}
test('worker clean audit automatically approves then completes',async()=>{const f=fixture();await f.worker.tick();assert.equal(f.calls[0],'run');assert.deepEqual(f.calls[1],[{id:'admin'},'a','approve_distinct',null,null,{automated:true}]);assert.deepEqual(f.statuses,['completed']);});
test('worker candidate goes to manual review, never automatic approval',async()=>{const f=fixture({candidates:[{candidate_product_id:'other'}]});await f.worker.tick();assert.deepEqual(f.calls,['run']);assert.deepEqual(f.statuses,['awaiting_review']);});
test('existing completed clean audit uses same gated branch',async()=>{const f=fixture({reused:true});await f.worker.tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0][2],'approve_distinct');assert.deepEqual(f.statuses,['completed']);});
test('existing human decision is not overwritten',async()=>{const f=fixture({reviews:[{decision:'request_correction'}]});await f.worker.tick();assert.deepEqual(f.calls,['run']);assert.deepEqual(f.statuses,['awaiting_review']);});
test('opt-out and pre-migration configuration retain manual review',async()=>{const f=fixture({auto:false});await f.worker.tick();assert.deepEqual(f.calls,['run']);assert.deepEqual(f.statuses,['awaiting_review']);});
test('disabled worker does not audit or approve',async()=>{const f=fixture({enabled:false});await f.worker.tick();assert.deepEqual(f.calls,[]);assert.deepEqual(f.statuses,[]);});
test('stale corpus conflict holds rather than publishes',async()=>{const f=fixture({reviewError:Object.assign(Error('Catalogue evidence changed'),{status:409})});await f.worker.tick();assert.deepEqual(f.statuses,['held']);});
test('revoked admin is held for eligible actor',async()=>{const f=fixture({reviewError:Object.assign(Error('Forbidden'),{status:403})});await f.worker.tick();assert.deepEqual(f.statuses,['actor_required']);});
