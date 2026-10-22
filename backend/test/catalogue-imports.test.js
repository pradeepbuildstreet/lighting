"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {createImports}=require('../services/catalogue-imports');
const P=require('../services/catalogue-workbook');
const id='11111111-1111-1111-1111-111111111111',actor={id},token='a'.repeat(64);
const payload={sku:'L1',name:'Lamp',product_kind:'light',specs:{light_type_id:id}};
const staged={id:1,sheet:'Products',row_number:7,action:'insert',staged_data:{payload,product_id:null,expected_revision:null},errors:[]};
function setup({job={id,created_by:id,preview_revision:token,status:'preview',expired:false},rows=[staged],existing=null,writeFail=false}={}){
 const calls=[],written=[];let outcome='';
 const c={query:async(sql,args)=>{calls.push([sql,args]);if(sql.includes('FROM import_jobs'))return {rows:job?[job]:[]};if(sql.includes('FROM import_row_results'))return {rows};if(sql.startsWith('SELECT id,revision'))return {rows:existing?[existing]:[]};if(sql.startsWith('INSERT INTO import_jobs'))return {rows:[{id,preview_revision:args[3]}]};return {rows:[]};}};
 const db={query:async()=>({rows:[]}),actor:async()=>{},transaction:async f=>{try{const r=await f(c);outcome='commit';return r;}catch(e){outcome='rollback';throw e;}}};
 const products={audit:async()=>{},writeProduct:async(_c,_actor,_id,data)=>{if(writeFail){const e=new Error('stale');e.status=409;throw e;}written.push(data);return {id,sku:data.sku,revision:2};}};
 return {service:createImports(db,products,async()=>[{sheet:'Products',row_number:7,payload,errors:[]}]),calls,written,outcome:()=>outcome,db,products};
}
test('commit writes validated draft payload and persists result',async()=>{const h=setup();const r=await h.service.commit(actor,id,token,false);assert.equal(r.products[0].sku,'L1');assert.equal(h.written.length,1);assert.equal(h.outcome(),'commit');assert.ok(h.calls.some(([sql])=>sql.includes("status='committed'")));});
test('committed replay performs no product writes',async()=>{const result={id,sku:'L1',revision:2};const h=setup({job:{id,created_by:id,preview_revision:token,status:'committed',expired:true},rows:[{...staged,staged_data:{result}}]});const r=await h.service.commit(actor,id,token);assert.equal(r.replayed,true);assert.deepEqual(r.products,[result]);assert.equal(h.written.length,0);});
test('stale writer rejection propagates transaction failure',async()=>{const h=setup({writeFail:true});await assert.rejects(h.service.commit(actor,id,token),e=>e.status===409);assert.equal(h.outcome(),'rollback');assert.ok(!h.calls.some(([s])=>s.includes("status='committed'")));});
test('expired job rejected',async()=>{const h=setup({job:{id,created_by:id,preview_revision:token,status:'preview',expired:true}});await assert.rejects(h.service.commit(actor,id,token),e=>e.status===409);assert.equal(h.written.length,0);});
test('foreign job owner rejected',async()=>{const h=setup();await assert.rejects(h.service.commit({id:'other'},id,token),e=>e.status===404);});
test('token mismatch rejected',async()=>{const h=setup();await assert.rejects(h.service.commit(actor,id,'b'.repeat(64)),e=>e.status===409);});
test('updates require explicit confirmation',async()=>{const h=setup({rows:[{...staged,action:'update'}]});await assert.rejects(h.service.commit(actor,id,token,false),e=>e.status===409);assert.equal(h.written.length,0);});
test('error rows block entire commit',async()=>{const h=setup({rows:[{...staged,action:'error'}]});await assert.rejects(h.service.commit(actor,id,token),e=>e.status===409);});
test('preview preserves source row and hashes workbook bytes',async()=>{const crypto=require('node:crypto'),h=setup();const bytes=Buffer.from('workbook');const r=await h.service.preview(actor,bytes);assert.equal(r.rows[0].row_number,7);assert.equal(h.written.length,0);const job=h.calls.find(([s])=>s.startsWith('INSERT INTO import_jobs'));assert.equal(job[1][2],crypto.createHash('sha256').update(bytes).digest('hex'));});
test('parse error retained in persisted preview',async()=>{const h=setup();const service=createImports(h.db,h.products,async()=>[{sheet:'Products',row_number:12,payload:null,errors:['Malformed JSON']}]);const r=await service.preview(actor,Buffer.from('workbook'));assert.equal(r.rows[0].row_number,12);assert.deepEqual(r.rows[0].errors,['Malformed JSON']);assert.equal(r.commit_ready,false);});
test('formula cell rejected',()=>assert.throws(()=>P.cell({formula:'1+1'}),e=>e.status===400));
test('invalid ZIP rejected',()=>assert.throws(()=>P.inspectZip(Buffer.from('invalid')),e=>e.status===400));
