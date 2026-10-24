"use strict";
const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createTagProductRouter,payload}=require('../api/catalogue-tag-products');
const id='11111111-1111-4111-8111-111111111111',product={sku:'TEST',product_kind_id:id,category_ids:[],tag_mode:'preserve'};
function fixture(){const state={storage_ready:true,publication_ready:true,activated:true},calls=[],handlers=new Map(),middleware=[];
 const router={use:f=>middleware.push(f),get:(p,f)=>handlers.set('GET '+p,f),post:(p,f)=>handlers.set('POST '+p,f),put:(p,f)=>handlers.set('PUT '+p,f)};
 const service={transaction:async(actor,work)=>{calls.push(['transaction',actor]);if(state.error)throw state.error;return work({query:async()=>({rows:[state]}),detail:async key=>{calls.push(['detail',key]);return {id:key};},writeProduct:async(...args)=>{calls.push(['write',...args]);return {id,revision:'3'};}});}};
 createTagProductRouter({express:{Router:()=>router},db:{query:async()=>{calls.push(['state']);return {rows:[state]};}},products:service});
 async function invoke(method,url,body={},admin={id}){const res={code:200,headers:{},status(c){this.code=c;return this;},set(k,v){this.headers[k]=v;return this;},json(v){this.body=v;return this;}};const req={admin,body,params:{id}};let proceed=false;middleware[0](req,res,()=>{proceed=true;});if(proceed)await handlers.get(method+' '+url)(req,res);return res;}
 return {state,calls,invoke};}
test('missing admin denied before service use',async()=>{const f=fixture(),r=await f.invoke('POST','/',{product},null);A.equal(r.code,401);A.equal(f.calls.length,0);A.equal(r.headers['Cache-Control'],'private, no-store');});
test('invalid actor rejected before database access',async()=>{const f=fixture();A.equal((await f.invoke('GET','/state',{}, {id:'bad'})).code,400);A.equal(f.calls.length,0);});
test('state exposes coordinated readiness',async()=>{const f=fixture(),r=await f.invoke('GET','/state');A.equal(r.body.write_enabled,true);A.equal(r.body.format_version,2);});
for(const key of ['storage_ready','publication_ready','activated'])test('missing '+key+' blocks writes',async()=>{const f=fixture();f.state[key]=false;A.equal((await f.invoke('POST','/',{product})).code,503);A.ok(!f.calls.some(c=>c[0]==='write'));A.equal((await f.invoke('GET','/state')).body.write_enabled,false);});
test('create delegates exact product to shared context',async()=>{const f=fixture(),r=await f.invoke('POST','/',{product});A.equal(r.code,201);A.deepEqual(f.calls.find(c=>c[0]==='write'),['write',null,product,null]);});
test('update preserves bigint revision as a string',async()=>{const f=fixture();A.equal((await f.invoke('PUT','/:id',{product,expected_revision:'9007199254740993'})).code,200);A.deepEqual(f.calls.find(c=>c[0]==='write'),['write',id,product,'9007199254740993']);});
test('detail delegates to shared context',async()=>{const f=fixture();A.equal((await f.invoke('GET','/:id')).body.product.id,id);A.ok(f.calls.some(c=>c[0]==='detail'));});
test('inactive detail does not access product',async()=>{const f=fixture();f.state.activated=false;A.equal((await f.invoke('GET','/:id')).code,503);A.ok(!f.calls.some(c=>c[0]==='detail'));});
for(const revision of [undefined,null,0,-1,true,1.5,'01','1e2','9223372036854775808',9007199254740992])test('reject revision '+String(revision),()=>A.throws(()=>payload({product,expected_revision:revision},true),e=>e.status===400));
for(const key of ['published','approved_revision','review_status','specs','product_kind'])test('reject protected/legacy field '+key,()=>A.throws(()=>payload({product:{...product,[key]:true}},false),e=>e.status===400));
test('create rejects revision envelope',()=>A.throws(()=>payload({product,expected_revision:1},false)));
test('unknown envelope rejected',()=>A.throws(()=>payload({product,unexpected:true},false)));
test('safe numeric revision canonicalised',()=>A.equal(payload({product,expected_revision:2},true).revision,'2'));
test('writer conflict mapped without fallback',async()=>{const f=fixture();f.state.error={code:'23505',message:'private database detail'};const r=await f.invoke('POST','/',{product});A.equal(r.code,409);A.ok(!r.body.error.includes('private'));});
test('unexpected errors are sanitised',async()=>{const f=fixture();f.state.error=Error('secret connection string');const r=await f.invoke('POST','/',{product});A.equal(r.code,503);A.equal(r.body.error,'Tag product API unavailable');});
test('shared revision error retained',async()=>{const f=fixture();f.state.error={status:409,message:'Product changed; reload before saving'};const r=await f.invoke('PUT','/:id',{product,expected_revision:'2'});A.equal(r.code,409);A.match(r.body.error,/Product changed/);});
test('product route mounted before generic taxonomy routes',()=>{const s=fs.readFileSync(path.join(__dirname,'../api/catalogue-taxonomy.js'),'utf8');A.ok(s.indexOf("router.use('/products-v2'")<s.indexOf("router.get('/:kind'"));});
