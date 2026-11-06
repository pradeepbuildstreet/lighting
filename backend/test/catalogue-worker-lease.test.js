"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {assertWorkerLease,LEASE_ERROR}=require('../services/catalogue-worker-lease');
const {createDuplicateService}=require('../services/catalogue-duplicates');
const ids=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`),[id,actorId,token,aid,other]=ids;
const actor={id:actorId},product={id,revision:'7',review_status:'pending_review'},claim={product_id:id,product_revision:'7',actor_id:actorId,generation:'2',lease_token:token};
const isLost=e=>e.status===409&&e.code==='DUPLICATE_JOB_LEASE_LOST';
test('lease check binds product revision, actor, generation and token under a row lock',async()=>{let call;await assertWorkerLease({query:async(sql,args)=>{call={sql,args};return {rows:[{product_id:id}]};}},actor,product,claim);assert.deepEqual(call.args,[id,'7',actorId,'2',token]);assert.match(call.sql,/status='processing'/);assert.match(call.sql,/lease_until>clock_timestamp\(\) FOR UPDATE/);});
test('missing or expired database lease fails closed',async()=>{await assert.rejects(assertWorkerLease({query:async()=>({rows:[]})},actor,product,claim),isLost);});
test('scope mismatches and malformed leases never reach SQL',async()=>{for(const patch of [null,{}, {...claim,product_id:other},{...claim,product_revision:'6'},{...claim,actor_id:other},{...claim,lease_token:'bad'},{...claim,generation:0},{...claim,generation:'-1'},{...claim,generation:'9223372036854775808'},{...claim,generation:Number.MAX_SAFE_INTEGER+1}]){let queried=false;await assert.rejects(assertWorkerLease({query:async()=>{queried=true;return {rows:[]};}},actor,product,patch),isLost);assert.equal(queried,false);}});
test('large bigint generations retain exact decimal precision',async()=>{let args;await assertWorkerLease({query:async(_s,a)=>{args=a;return {rows:[{product_id:id}]};}},actor,product,{...claim,generation:'9007199254740993'});assert.equal(args[3],'9007199254740993');});
function auditFixture({leaseValid=false,status='approved',reviewed=false,latestRevision='7'}={}){
 const p={...product,review_status:status,approved_revision:status==='approved'?'7':null,approved_by:status==='approved'?actorId:null},calls=[];
 const query=async(sql,args=[])=>{calls.push({sql,args});if(sql.startsWith('SELECT * FROM products'))return {rows:[p]};if(sql.startsWith('SELECT * FROM product_duplicate_audits'))return {rows:[{id:aid,product_id:id,product_revision:'7',status:'completed'}]};if(sql.startsWith('SELECT product_id FROM public.catalogue_duplicate_jobs'))return {rows:leaseValid?[{product_id:id}]:[]};if(sql.startsWith('SELECT id,product_revision FROM product_duplicate_audits'))return {rows:[{id:aid,product_revision:latestRevision}]};if(sql.startsWith('SELECT id FROM product_duplicate_audits'))return {rows:[{id:aid}]};if(sql.startsWith('SELECT id FROM product_duplicate_reviews'))return {rows:reviewed?[{id:other}]:[]};if(sql.includes('AS tag_model'))throw Error('MODEL_VALIDATION_REACHED');return {rows:[]};};
 return {p,calls,service:createDuplicateService({actor:async()=>{},transaction:fn=>fn({query})})};
}
const noWrites=f=>assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)),false);
test('stale worker cannot reset a retained primary approval',async()=>{const f=auditFixture(),before={...f.p};await assert.rejects(f.service.run(actor,id,'7',{jobLease:claim}),isLost);assert.deepEqual(f.p,before);noWrites(f);const productLock=f.calls.findIndex(c=>c.sql.startsWith('SELECT * FROM products')),leaseLock=f.calls.findIndex(c=>c.sql.startsWith('SELECT product_id FROM'));assert.ok(productLock>=2&&leaseLock>productLock);});
test('stale refresh cannot create a replacement audit',async()=>{const f=auditFixture({status:'pending_review'});await assert.rejects(f.service.run(actor,id,'7',{refreshAuditId:aid,jobLease:claim}),isLost);noWrites(f);});
test('stale automatic approval cannot insert a review',async()=>{const f=auditFixture({status:'pending_review'});await assert.rejects(f.service.review(actor,aid,'approve_distinct',null,null,{automated:true,jobLease:claim}),isLost);noWrites(f);});
test('even an owned job cannot replace completed approval',async()=>{const f=auditFixture({leaseValid:true});await assert.rejects(f.service.run(actor,id,'7',{jobLease:claim}),e=>e.status===409&&/completed approval/.test(e.message));noWrites(f);});
test('current manual correction blocks ordinary automatic rerun',async()=>{const f=auditFixture({leaseValid:true,status:'draft',reviewed:true});await assert.rejects(f.service.run(actor,id,'7',{jobLease:claim}),e=>e.status===409&&/recorded review/.test(e.message));noWrites(f);});
test('a review of an older product revision does not prevent normal current model validation',async()=>{const f=auditFixture({leaseValid:true,status:'draft',reviewed:true,latestRevision:'6'});await assert.rejects(f.service.run(actor,id,'7',{jobLease:claim}),/MODEL_VALIDATION_REACHED/);noWrites(f);});
test('manual fresh audit remains explicit and does not require a worker lease',async()=>{const f=auditFixture();await assert.rejects(f.service.run(actor,id,'7'),/MODEL_VALIDATION_REACHED/);assert.equal(f.calls.some(c=>c.sql.startsWith('SELECT product_id FROM')),false);});
function fullFixture(){
 const state={p:{...product,review_status:'draft',duplicate_of_product_id:null,attributes:{product_kind_id:other},tags:[],image_hashes:[],is_active:false},audit:null,leaseValid:true,reviews:[],calls:[]};
 const query=async(sql,args=[])=>{state.calls.push({sql,args});
  if(sql.startsWith('SELECT * FROM products'))return {rows:[state.p]};
  if(sql.startsWith('SELECT product_id FROM public.catalogue_duplicate_jobs'))return {rows:state.leaseValid?[{product_id:id}]:[]};
  if(sql.startsWith('SELECT id,product_revision FROM product_duplicate_audits')||sql.startsWith('SELECT id FROM product_duplicate_audits'))return {rows:state.audit?[state.audit]:[]};
  if(sql.startsWith('SELECT EXISTS'))return {rows:[{tag_model:true}]};
  if(sql.includes('FROM catalogue_taxonomy_versions'))return {rows:[{version:3}]};
  if(sql.startsWith('SELECT p.* FROM products'))return {rows:[state.p]};
  if(sql.startsWith('INSERT INTO product_duplicate_audits')){state.audit={id:aid,product_id:id,product_revision:args[1],status:'running',algorithm_version:args[2],corpus_digest:args[4],scanned_count:args[5]};return {rows:[{...state.audit}]};}
  if(sql.includes("SET status='completed'"))state.audit.status='completed';
  if(sql.startsWith('UPDATE product_duplicate_audits SET corpus_digest'))state.audit.corpus_digest=args[1];
  if(sql.includes("review_status='pending_review'"))state.p.review_status='pending_review';
  if(sql.startsWith('SELECT * FROM product_duplicate_audits'))return {rows:[state.audit]};
  if(sql.startsWith('SELECT id FROM product_duplicate_reviews'))return {rows:state.reviews};
  if(sql.startsWith('SELECT enabled'))return {rows:[{enabled:true}]};
  if(sql.startsWith('SELECT count(*)'))return {rows:[{count:0}]};
  if(sql.startsWith('INSERT INTO product_duplicate_reviews')){const row={id:other,decision:args[1]};state.reviews.push(row);return {rows:[row]};}
  if(sql.startsWith('UPDATE products SET published=false,review_status=')){state.p.review_status=args[1];state.p.approved_revision=args[3];state.p.approved_by=args[4];}
  return {rows:[]};
 };
 const db={actor:async()=>{},transaction:fn=>fn({query})},tagScoring={ALGORITHM:'tags-evidence-v2',loadEvidence:async(_c,rows)=>rows,compare:()=>null};
 return {state,service:createDuplicateService(db,{tagScoring})};
}
test('owned lease completes a clean audit and automatic review through normal checks',async()=>{const f=fullFixture();await f.service.run(actor,id,'7',{jobLease:claim});const r=await f.service.review(actor,aid,'approve_distinct',null,null,{automated:true,jobLease:claim});assert.equal(r.review_status,'approved');assert.equal(f.state.p.is_active,false);assert.equal(f.state.reviews.length,1);assert.equal(f.state.calls.filter(c=>c.sql.startsWith('SELECT product_id FROM public.catalogue_duplicate_jobs')).length,2);});
test('generation invalidation between audit and approval protects the later approval',async()=>{const f=fullFixture();await f.service.run(actor,id,'7',{jobLease:claim});f.state.leaseValid=false;Object.assign(f.state.p,{review_status:'approved',approved_revision:'7',approved_by:actorId});const before=f.state.calls.length;await assert.rejects(f.service.review(actor,aid,'approve_distinct',null,null,{automated:true,jobLease:claim}),isLost);assert.equal(f.state.p.review_status,'approved');assert.equal(f.state.reviews.length,0);assert.equal(f.state.calls.slice(before).some(c=>/^(INSERT|UPDATE)/.test(c.sql)),false);});
