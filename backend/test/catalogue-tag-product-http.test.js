"use strict";
const test=require('node:test'),A=require('node:assert/strict'),http=require('node:http'),express=require('express');
const {createTagProductRouter}=require('../api/catalogue-tag-products');
const C=require('../services/catalogue-tag-product-core');
const id='11111111-1111-4111-8111-111111111111';
const kind={id,code:'fixture',entry_profile:'fixture',fixed_source_mode:null,is_active:true};
const product={sku:'HTTP-TEST',name:'Protocol fixture',product_kind_id:id,category_ids:[],tag_ids:[],attributes:{length_mm:'100'}};
async function fixture(t){
 const state={storage_ready:true,publication_ready:true,activated:true},writes=[];
 const products={transaction:async(actor,work)=>work({query:async()=>({rows:[state]}),detail:async key=>({id:key,revision:'2',attributes:{product_kind_id:id}}),writeProduct:async(key,input,revision)=>{if(state.conflict){const e=new Error('Product changed; reload before saving');e.status=409;throw e;}const d=C.normalise(input,{creating:!key}),attributes=C.attributes(kind,d.attributes);writes.push({actor,key,revision,data:d});return {id:key||id,revision:'3',...d,attributes:{...attributes,product_kind_id:id}};}})};
 const app=express();app.use(express.json({limit:'32kb'}));
 // Test-only context injection: this does not test production session/origin authentication.
 app.use((req,_res,next)=>{if(req.get('x-test-admin')==='yes')req.admin={id};next();});
 app.use('/taxonomy/products-v2',createTagProductRouter({express,db:{query:async()=>({rows:[state]})},products}));
 const server=http.createServer(app);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
 const base='http://127.0.0.1:'+server.address().port+'/taxonomy/products-v2';
 async function request(path,method='GET',body,admin=true){const r=await fetch(base+path,{method,headers:{...(admin?{'x-test-admin':'yes'}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()};}
 return {state,writes,request};
}
test('real HTTP denies missing admin context before writes',{timeout:10000},async t=>{const f=await fixture(t),r=await f.request('/state','GET',undefined,false);A.equal(r.status,401);A.equal(r.cache,'private, no-store');A.equal(f.writes.length,0);});
test('real HTTP state stays readable before activation',{timeout:10000},async t=>{const f=await fixture(t);f.state.activated=false;const r=await f.request('/state');A.equal(r.status,200);A.equal(r.body.write_enabled,false);});
test('real HTTP mounted root create uses actual normaliser',{timeout:10000},async t=>{const f=await fixture(t),r=await f.request('/','POST',{product});A.equal(r.status,201);A.equal(r.body.product.sku,'HTTP-TEST');A.equal(r.body.product.attributes.length_mm,100);A.equal(f.writes.length,1);A.equal(f.writes[0].actor.id,id);});
test('real HTTP update preserves large revision strings',{timeout:10000},async t=>{const f=await fixture(t),r=await f.request('/'+id,'PUT',{product,expected_revision:'9007199254740993'});A.equal(r.status,200);A.equal(f.writes[0].revision,'9007199254740993');});
test('real HTTP detail is mounted',{timeout:10000},async t=>{const f=await fixture(t),r=await f.request('/'+id);A.equal(r.status,200);A.equal(r.body.product.id,id);});
test('real HTTP rejects protected product fields',{timeout:10000},async t=>{const f=await fixture(t),r=await f.request('/','POST',{product:{...product,published:true}});A.equal(r.status,400);A.equal(f.writes.length,0);});
test('real HTTP core validation rejects retired attributes',{timeout:10000},async t=>{const f=await fixture(t),r=await f.request('/','POST',{product:{...product,attributes:{material:'brass'}}});A.equal(r.status,400);A.equal(f.writes.length,0);});
test('real HTTP inactive cutover cannot write',{timeout:10000},async t=>{const f=await fixture(t);f.state.activated=false;const r=await f.request('/','POST',{product});A.equal(r.status,503);A.equal(f.writes.length,0);});
test('real HTTP revision conflict has no retry fallback',{timeout:10000},async t=>{const f=await fixture(t);f.state.conflict=true;const r=await f.request('/'+id,'PUT',{product,expected_revision:'2'});A.equal(r.status,409);A.equal(f.writes.length,0);});
