"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {createImports}=require('../services/catalogue-imports');
const id='11111111-1111-4111-8111-111111111111',actor={id};
const category={id,name:'Pendants',slug:'pendants',is_active:true,allow_direct_products:true};
async function preview(categories,ids=[id]){
 const reads=[];const c={query:async(sql,args)=>({rows:sql.startsWith('INSERT INTO import_jobs')?[{id,preview_revision:args[3]}]:[]})};
 const db={actor:async()=>{},query:async sql=>{reads.push(sql);return {rows:sql.includes('FROM categories')?categories:[]};},transaction:fn=>fn(c)};
 const products={audit:async()=>{},writeProduct:async()=>{throw Error('Preview must not write products');}};
 const payload={sku:'TRIAL',name:'Trial',product_kind:'light',specs:{light_type_id:id},category_ids:ids};
 const service=createImports(db,products,async()=>[{sheet:'Products',row_number:7,payload,errors:[]}]);
 return {result:await service.preview(actor,Buffer.from('workbook')),reads};
}
test('assignable category previews successfully',async()=>assert.equal((await preview([category])).result.commit_ready,true));
test('group-only assignment is preview error',async()=>{const {result}=await preview([{...category,allow_direct_products:false}]);assert.equal(result.commit_ready,false);assert.match(result.rows[0].errors[0],/assignable subcategory/);assert.equal(result.rows[0].row_number,7);});
test('inactive assignment is preview error',async()=>assert.equal((await preview([{...category,is_active:false}])).result.commit_ready,false));
test('missing assignment is preview error',async()=>assert.equal((await preview([])).result.commit_ready,false));
test('unknown policy fails closed',async()=>{const row={...category};delete row.allow_direct_products;assert.equal((await preview([row])).result.commit_ready,false);});
test('draft without categories remains supported',async()=>assert.equal((await preview([],[])).result.commit_ready,true));
test('preview fetches category references once',async()=>{const {reads}=await preview([category]);assert.equal(reads.filter(sql=>sql.includes('FROM categories')).length,1);assert.match(reads.find(sql=>sql.includes('FROM categories')),/allow_direct_products/);});
