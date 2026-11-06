"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../services/catalogue-group-review-policy');
const ids=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const products=()=>ids.slice(0,5).map(id=>({id,revision:'7',review_status:'pending_review',duplicate_of_product_id:null,is_active:false}));
const retain=p=>({product_id:p.id,revision:p.revision,disposition:'retain'});
const duplicate=(p,target)=>({...retain(p),disposition:'duplicate',duplicate_of_product_id:target});
const rejects=(fn,status)=>assert.throws(fn,error=>error.status===status);
test('all five products can be approved as distinct without activation changes',()=>{
 const rows=products(),result=P.validateGroupDecisions(rows,rows.map(retain));
 assert.deepEqual(result.map(r=>r.decision),Array(5).fill('approve_distinct'));
 assert.ok(result.every(r=>!r.deactivate&&!r.unpublish));
 assert.ok(rows.every(r=>r.is_active===false));
});
test('two duplicate clusters and one distinct product are recorded individually',()=>{
 const r=products(),result=P.validateGroupDecisions(r,[retain(r[0]),duplicate(r[1],r[0].id),retain(r[2]),duplicate(r[3],r[2].id),retain(r[4])]);
 assert.deepEqual(result.map(x=>x.decision),['retain_primary','confirm_duplicate','retain_primary','confirm_duplicate','approve_distinct']);
 assert.deepEqual(result.filter(x=>x.deactivate).map(x=>x.product_id),[r[1].id,r[3].id]);
});
test('one retained product can have four duplicates, even while inactive',()=>{
 const r=products(),result=P.validateGroupDecisions(r,[retain(r[0]),...r.slice(1).map(p=>duplicate(p,r[0].id))]);
 assert.equal(result[0].decision,'retain_primary');
 assert.ok(result.slice(1).every(x=>x.duplicate_of_product_id===r[0].id&&x.deactivate&&x.unpublish));
});
test('one duplicate does not incorrectly label other retained products as primary',()=>{
 const r=products(),result=P.validateGroupDecisions(r,[retain(r[0]),duplicate(r[1],r[0].id),...r.slice(2).map(retain)]);
 assert.deepEqual(result.map(x=>x.decision),['retain_primary','confirm_duplicate','approve_distinct','approve_distinct','approve_distinct']);
});
test('decision order does not change product mapping',()=>{
 const r=products();assert.deepEqual(P.validateGroupDecisions(r,r.map(retain).reverse()).map(x=>x.product_id),r.map(p=>p.id));
});
test('self references are rejected',()=>{const r=products();rejects(()=>P.validateGroupDecisions(r,[duplicate(r[0],r[0].id),...r.slice(1).map(retain)]),400);});
test('duplicate chains and cycles are rejected',()=>{
 const r=products();
 rejects(()=>P.validateGroupDecisions(r,[duplicate(r[0],r[1].id),duplicate(r[1],r[2].id),...r.slice(2).map(retain)]),400);
 rejects(()=>P.validateGroupDecisions(r,[duplicate(r[0],r[1].id),duplicate(r[1],r[0].id),...r.slice(2).map(retain)]),400);
});
test('a target outside the reviewed group is rejected',()=>{const r=products();rejects(()=>P.validateGroupDecisions(r,[duplicate(r[0],ids[5]),...r.slice(1).map(retain)]),400);});
test('missing and repeated product decisions are rejected',()=>{
 const r=products();rejects(()=>P.validateGroupDecisions(r,r.slice(1).map(retain)),400);
 rejects(()=>P.validateGroupDecisions(r,[retain(r[0]),retain(r[0]),...r.slice(2).map(retain)]),400);
});
test('unresolved decisions cannot silently become approvals',()=>{const r=products();rejects(()=>P.validateGroupDecisions(r,[{...retain(r[0]),disposition:'unresolved'},...r.slice(1).map(retain)]),400);});
test('stale or missing revisions reject the whole group',()=>{
 const r=products();for(const revision of ['6',null,undefined,'0','07'])rejects(()=>P.validateGroupDecisions(r,[{...retain(r[0]),revision},...r.slice(1).map(retain)]),409);
});
test('retained products cannot also have duplicate targets',()=>{const r=products();rejects(()=>P.validateGroupDecisions(r,[{...retain(r[0]),duplicate_of_product_id:r[1].id},...r.slice(1).map(retain)]),400);});
test('duplicate status excludes a product even without a target',()=>{
 assert.equal(P.eligibleForDuplicateReview({review_status:'duplicate',duplicate_of_product_id:null}),false);
});
test('a duplicate target excludes a product even with inconsistent review status',()=>{
 assert.equal(P.eligibleForDuplicateReview({review_status:'pending_review',duplicate_of_product_id:ids[0]}),false);
});
test('inactivity alone never excludes a legitimate product',()=>{assert.equal(P.eligibleForDuplicateReview({review_status:'pending_review',is_active:false,duplicate_of_product_id:null}),true);});
test('a confirmed duplicate cannot be reintroduced by a group submission',()=>{
 const r=products();r[1].review_status='duplicate';rejects(()=>P.validateGroupDecisions(r,r.map(retain)),409);
});
test('rejected and archived subjects cannot be implicitly reopened',()=>{
 for(const review_status of ['rejected','archived'])rejects(()=>P.assertEligibleSubject({review_status,duplicate_of_product_id:null}),409);
});
test('duplicate group products are rejected',()=>{const r=products();r[1]={...r[0]};rejects(()=>P.validateGroupDecisions(r,r.map(retain)),400);});
test('invalid and single-product groups are rejected',()=>{
 rejects(()=>P.validateGroupDecisions(null,[]),400);const r=products();rejects(()=>P.validateGroupDecisions(r.slice(0,1),r.slice(0,1).map(retain)),400);
 r[0].id='not-a-product-id';rejects(()=>P.validateGroupDecisions(r,r.map(retain)),400);
});
