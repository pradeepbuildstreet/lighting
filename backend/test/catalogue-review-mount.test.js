"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {mountReviewRoutes}=require('../api/catalogue-review-mount');
test('both router factories mounted in order without replacing existing routes',()=>{
 const calls=[];let latest;
 const router={use:x=>calls.push(x),get:(p,fn)=>{latest={p,fn};}};
 mountReviewRoutes(router,{}, {},{duplicateFactory:()=> 'duplicates',publicationFactory:()=> 'publication'});
 assert.deepEqual(calls,['duplicates','publication']);assert.equal(latest.p,'/products/:id/duplicate-audits/latest');
});
test('latest-audit handler validates ID before database access',async()=>{
 let handler,queried=false,status;
 const router={use:()=>{},get:(_p,fn)=>{handler=fn;}};
 mountReviewRoutes(router,{}, {query:async()=>{queried=true;return {rows:[]};}},{duplicateFactory:()=>({}),publicationFactory:()=>({})});
 const res={status:s=>{status=s;return res;},json:()=>res};await handler({params:{id:'bad'}},res);assert.equal(status,400);assert.equal(queried,false);
});
