"use strict";
const test=require('node:test'),A=require('node:assert/strict'),http=require('node:http'),express=require('express'),multer=require('multer'),ExcelJS=require('exceljs');
const {createTagImportRouter}=require('../api/catalogue-tag-imports'),{createTagImports}=require('../services/catalogue-tag-imports'),W=require('../services/catalogue-tag-workbook'),C=require('../services/catalogue-tag-product-core');
const actor='11111111-1111-4111-8111-111111111111',jobId='22222222-2222-4222-8222-222222222222',groupId='33333333-3333-4333-8333-333333333333',tagId='44444444-4444-4444-8444-444444444444',productId='55555555-5555-4555-8555-555555555555';
const refs={kinds:[{id:actor,code:'fixture',name:'Fixtures',is_active:true,entry_profile:'fixture',fixed_source_mode:null}],categories:[],category_groups:[],groups:[{id:groupId,code:'material',name:'Material',is_active:true}],tags:[{id:tagId,tag_group_id:groupId,code:'brass',name:'Brass',is_active:true}]};
async function workbook(tag='brass'){const b=new ExcelJS.Workbook();b.addWorksheet('Metadata').addRows([['key','value'],['format_version',2]]);const row={sku:'XLSX-HTTP',name:'Roundtrip fixture',product_kind_code:'fixture',selling_price:'1250.50',tag_mode:'replace'};b.addWorksheet('Products').addRows([W.PRODUCT_COLUMNS,W.PRODUCT_COLUMNS.map(k=>row[k]??'')]);b.addWorksheet('ProductTags').addRows([W.TAG_COLUMNS,['XLSX-HTTP','material',tag]]);return Buffer.from(await b.xlsx.writeBuffer());}
async function fixture(t,existing=false){
 const state={enabled:true,refs:structuredClone(refs),job:null,rows:[],writes:[],failWrite:false};
 const query=async(s,a=[])=>{
  if(s.includes('FROM catalogue_taxonomy_versions'))return {rows:state.enabled?[{version:3}]:[]};
  if(s.startsWith('SELECT id,sku,revision'))return {rows:existing?[{id:productId,sku:'XLSX-HTTP',revision:'2',product_kind:'fixture'}]:[]};
  if(s.startsWith('INSERT INTO import_jobs')){state.job={id:jobId,created_by:a[0],status:'preview',mode:a[1],preview_revision:a[3],expired:false};return {rows:[{...state.job}]};}
  if(s.startsWith('INSERT INTO import_row_results'))state.rows=JSON.parse(a[1]).map((r,i)=>({...r,id:String(i+1)}));
  if(s.includes('FROM import_jobs'))return {rows:state.job&&(!a[1]||state.job.created_by===a[1])?[{...state.job}]:[]};
  if(s.includes('FROM import_row_results'))return {rows:state.rows};
  if(s.startsWith('UPDATE import_row_results'))for(const u of JSON.parse(a[1]))state.rows.find(r=>r.id===u.id).staged_data=u.staged_data;
  if(s.includes("SET status='committing'"))state.job.status='committing';
  if(s.includes("SET status='committed'"))state.job.status='committed';
  return {rows:[]};
 };
 const transaction=async work=>{const before=structuredClone({job:state.job,rows:state.rows,writes:state.writes});try{return await work({query,writeProduct:async(id,input,revision)=>{if(state.failWrite)C.fail('Simulated stale product revision',409);const d=C.normalise(input,{creating:!id});C.attributes(state.refs.kinds[0],d.attributes);state.writes.push({id,input:d,revision});return {id:id||productId,sku:d.sku,revision:'3'};}});}catch(e){Object.assign(state,before);throw e;}};
 const db={query,transaction},products={transaction:async(_actor,work)=>{if(!state.enabled)C.fail('Integrated tag-product cutover is not activated',503);return transaction(work);}},imports=createTagImports(db,products,async()=>{},{loadReferences:async()=>state.refs});
 const app=express();app.use(express.json());
 // Fixture context only, not production session/origin authentication.
 app.use((req,_res,next)=>{const id=req.get('x-test-admin');if(id)req.admin={id};next();});
 app.use('/imports-v2',createTagImportRouter({express,multer,db,importService:imports}));
 const server=http.createServer(app);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
 const base='http://127.0.0.1:'+server.address().port+'/imports-v2';
 async function request(path,method='GET',body,owner=actor){const form=body instanceof FormData,r=await fetch(base+path,{method,headers:{...(owner?{'x-test-admin':owner}:{}),...(body!==undefined&&!form?{'content-type':'application/json'}:{})},...(body===undefined?{}:{body:form?body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});const content=r.headers.get('content-type')||'';return {status:r.status,content,body:content.includes('application/json')?await r.json():Buffer.from(await r.arrayBuffer())};}
 async function upload({mode='create',tag='brass',name='products.xlsx',buffer,owner=actor}={}){const f=new FormData();f.append('mode',mode);f.append('file',new Blob([buffer||await workbook(tag)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name);return request('/upload','POST',f,owner);}
 const commit=(p,confirm,owner=actor)=>request('/'+p.body.job.id+'/commit','POST',{preview_revision:p.body.job.preview_revision,...(confirm===undefined?{}:{confirm_replacement:confirm})},owner);
 return {state,request,upload,commit};
}
test('template endpoint returns a decodable blank v2 XLSX',{timeout:20000},async t=>{const f=await fixture(t),r=await f.request('/template');A.equal(r.status,200);A.match(r.content,/spreadsheetml/);const b=new ExcelJS.Workbook();await b.xlsx.load(r.body);const parsed=W.readSheets(b);A.equal(parsed.format_version,2);A.equal(parsed.products.length,0);A.deepEqual(b.getWorksheet('Products').getRow(1).values.slice(1),W.PRODUCT_COLUMNS);});
test('multipart XLSX preview resolves tags and price',{timeout:20000},async t=>{const f=await fixture(t),p=await f.upload();A.equal(p.status,201);A.equal(p.body.commit_ready,true);A.deepEqual(p.body.rows[0].staged_data.payload.tag_ids,[tagId]);A.equal(p.body.rows[0].staged_data.payload.selling_price,'1250.50');A.equal(f.state.writes.length,0);});
test('preview commit and HTTP replay write once',{timeout:20000},async t=>{const f=await fixture(t),p=await f.upload(),a=await f.commit(p),b=await f.commit(p);A.equal(a.status,200);A.equal(b.body.replayed,true);A.equal(f.state.writes.length,1);});
test('unknown ProductTags reference blocks commit',{timeout:20000},async t=>{const f=await fixture(t),p=await f.upload({tag:'typo'});A.equal(p.status,201);A.equal(p.body.commit_ready,false);A.equal((await f.commit(p)).status,409);A.equal(f.state.writes.length,0);});
test('reference drift rejects HTTP commit',{timeout:20000},async t=>{const f=await fixture(t),p=await f.upload();f.state.refs.tags[0].is_active=false;A.equal((await f.commit(p)).status,409);A.equal(f.state.writes.length,0);});
test('updates require explicit replacement confirmation',{timeout:20000},async t=>{const f=await fixture(t,true),p=await f.upload({mode:'update'});A.equal((await f.commit(p)).status,409);A.equal((await f.commit(p,true)).status,200);A.equal(f.state.writes[0].revision,'2');});
test('writer conflict propagates and restores mock job state',{timeout:20000},async t=>{const f=await fixture(t),p=await f.upload();f.state.failWrite=true;A.equal((await f.commit(p)).status,409);A.equal(f.state.job.status,'preview');A.equal(f.state.writes.length,0);});
test('foreign owner cannot reload or commit preview',{timeout:20000},async t=>{const f=await fixture(t),p=await f.upload();A.equal((await f.request('/'+jobId,'GET',undefined,groupId)).status,404);A.equal((await f.commit(p,undefined,groupId)).status,404);});
test('inactive cutover rejects real multipart upload',{timeout:20000},async t=>{const f=await fixture(t);f.state.enabled=false;A.equal((await f.upload()).status,503);A.equal(f.state.job,null);});
test('missing admin rejected before preview',{timeout:20000},async t=>{const f=await fixture(t);A.equal((await f.upload({owner:null})).status,401);A.equal(f.state.job,null);});
test('non-XLSX filename rejected by mounted route',{timeout:20000},async t=>{const f=await fixture(t);A.equal((await f.upload({name:'products.txt'})).status,400);});
test('multer file limit enforced before parsing',{timeout:20000},async t=>{const f=await fixture(t);A.equal((await f.upload({buffer:Buffer.alloc(5242881)})).status,413);A.equal(f.state.job,null);});
