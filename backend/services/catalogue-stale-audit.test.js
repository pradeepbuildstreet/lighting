"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {createDuplicateWorker}=require('./catalogue-duplicate-worker');
const stale=()=>Object.assign(Error('Catalogue evidence changed; rerun the audit'),{status:409});
function fixture({firstError=stale(),secondError=null,freshCandidates=[],freshReviews=[],runError=null,reviews=[],auto=true}={}){
 const calls=[],statuses=[];let checks=0;
 const service={
  detail:async id=>({candidates:id==='new'?freshCandidates:[],reviews:id==='new'?freshReviews:reviews}),
  review:async(...args)=>{calls.push(['review',...args]);const e=checks++===0?firstError:secondError;if(e)throw e;},
  run:async(...args)=>{calls.push(['run',...args]);if(runError)throw runError;return {audit:{id:'new'}};}
 };
 const query=async(sql,args)=>{
  if(sql.includes('to_regclass'))return {rows:[{ready:true}]};
  if(sql.startsWith('SELECT enabled'))return {rows:[{enabled:true,auto_approve_clean_audits:auto}]};
  if(sql.startsWith('WITH due'))return {rows:[{product_id:'p',product_revision:8,actor_id:'admin',generation:2,lease_token:'lease',attempts:1}]};
  if(sql.includes('SELECT p.revision'))return {rows:[{revision:8,review_status:'pending_review',audit_id:'old',audit_status:'completed',product_revision:8,algorithm_version:'tags-evidence-v2',corpus_digest:'old-digest'}]};
  if(sql.includes('SET status=$4'))statuses.push(args[3]);
  return {rows:[]};
 };
 const db={query,transaction:async fn=>fn({query})};
 return {calls,statuses,worker:createDuplicateWorker(db,{duplicateFactory:()=>service})};
}
test('stale evidence gets exactly one guarded fresh audit before approval',async()=>{const f=fixture();await f.worker.tick();assert.deepEqual(f.calls.map(c=>c[0]),['review','run','review']);assert.deepEqual(f.calls[1],['run',{id:'admin'},'p','8',{refreshAuditId:'old'}]);assert.equal(f.calls[2][2],'new');assert.deepEqual(f.statuses,['completed']);});
test('fresh scan finding a candidate waits for manual review',async()=>{const f=fixture({freshCandidates:[{id:'match'}]});await f.worker.tick();assert.deepEqual(f.calls.map(c=>c[0]),['review','run']);assert.deepEqual(f.statuses,['awaiting_review']);});
test('a second stale conflict holds without unbounded rescans',async()=>{const f=fixture({secondError:stale()});await f.worker.tick();assert.equal(f.calls.filter(c=>c[0]==='run').length,1);assert.deepEqual(f.statuses,['held']);});
test('unrelated revision conflicts never trigger a refresh',async()=>{const f=fixture({firstError:Object.assign(Error('Product changed; reload'),{status:409})});await f.worker.tick();assert.deepEqual(f.calls.map(c=>c[0]),['review']);assert.deepEqual(f.statuses,['held']);});
test('revoked administrator never triggers a refresh',async()=>{const f=fixture({firstError:Object.assign(Error('Forbidden'),{status:403})});await f.worker.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.statuses,['actor_required']);});
test('uncertain approval failure does not blindly rescan or retry',async()=>{const f=fixture({firstError:Object.assign(Error('Unavailable'),{status:503})});await f.worker.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.statuses,['pending']);});
test('manual decision before routing remains untouched',async()=>{const f=fixture({reviews:[{decision:'request_correction'}]});await f.worker.tick();assert.deepEqual(f.calls,[]);assert.deepEqual(f.statuses,['awaiting_review']);});
test('manual decision appearing after refresh remains untouched',async()=>{const f=fixture({freshReviews:[{decision:'reject'}]});await f.worker.tick();assert.deepEqual(f.calls.map(c=>c[0]),['review','run']);assert.deepEqual(f.statuses,['awaiting_review']);});
test('failed guarded refresh holds without attempting approval',async()=>{const f=fixture({runError:Object.assign(Error('Manual decision changed'),{status:409})});await f.worker.tick();assert.deepEqual(f.calls.map(c=>c[0]),['review','run']);assert.deepEqual(f.statuses,['held']);});
test('already fresh clean audit does not get a redundant scan',async()=>{const f=fixture({firstError:null});await f.worker.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.statuses,['completed']);});
test('opt-out never refreshes or approves',async()=>{const f=fixture({auto:false});await f.worker.tick();assert.deepEqual(f.calls,[]);assert.deepEqual(f.statuses,['awaiting_review']);});
const fs=require('node:fs'),vm=require('node:vm');
const exported={exports:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('./catalogue-duplicates'),'utf8'),{module:exported,require:id=>id==='../validators/catalogue'?{uuid:()=>{},num:v=>Number(v)}:id==='./catalogue-duplicate-model'?{}:require(id)});
async function refreshGuard({status='pending_review',duplicate=null,latest='old',reviewed=false,revision=8}={}){
 const query=async sql=>{
  if(sql.startsWith('SELECT * FROM products'))return {rows:[{id:'p',revision,review_status:status,duplicate_of_product_id:duplicate}]};
  if(sql.startsWith('SELECT id FROM product_duplicate_audits'))return {rows:[{id:latest}]};
  if(sql.startsWith('SELECT id FROM product_duplicate_reviews'))return {rows:reviewed?[{id:'review'}]:[]};
  if(sql.includes('AS tag_model'))throw Error('MODEL_VALIDATION_REACHED');
  return {rows:[]};
 };
 const db={actor:async()=>{},transaction:async fn=>fn({query})};
 return exported.exports.createDuplicateService(db).run({id:'admin'},'p','8',{refreshAuditId:'old'});
}
test('refresh guard respects every manual outcome',async()=>{for(const status of ['approved','draft','duplicate','rejected','archived'])await assert.rejects(refreshGuard({status}),/manual decision/);});
test('refresh guard respects confirmed duplicate link',async()=>assert.rejects(refreshGuard({duplicate:'other'}),/manual decision/));
test('refresh guard rejects a newer audit',async()=>assert.rejects(refreshGuard({latest:'newer'}),/newer audit/));
test('refresh guard rejects an intervening review',async()=>assert.rejects(refreshGuard({reviewed:true}),/already reviewed/));
test('refresh guard rejects a changed revision',async()=>assert.rejects(refreshGuard({revision:9}),/Product changed/));
test('eligible refresh still enters normal model validation',async()=>assert.rejects(refreshGuard(),/MODEL_VALIDATION_REACHED/));
