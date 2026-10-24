"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../services/catalogue-tag-product-core'),{createTagProductService}=require('../services/catalogue-tag-products');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',G='33333333-3333-4333-8333-333333333333',T='44444444-4444-4444-8444-444444444444';
const fixture={id:A,code:'fixture',is_active:true,entry_profile:'fixture',fixed_source_mode:null},lamp={id:B,code:'integrated-light',is_active:true,entry_profile:'light_source',fixed_source_mode:'integrated'};
const body=(extra={})=>({sku:'TEST',name:'Test',product_kind_id:A,category_ids:[],attributes:{},...extra});
for(const [name,fn] of [
 ['SKU canonicalised',()=>assert.equal(C.normalise(body({sku:'test'})).sku,'TEST')],
 ['legacy specs rejected',()=>assert.throws(()=>C.normalise(body({specs:{}})))],
 ['category replacement explicit',()=>assert.throws(()=>C.normalise({sku:'X',name:'X',product_kind_id:A}))],
 ['duplicate tag IDs rejected',()=>assert.throws(()=>C.normalise(body({tag_ids:[T,T],tag_mode:'replace'})))],
 ['update tags need explicit mode',()=>assert.throws(()=>C.normalise(body({tag_ids:[T]})))],
 ['draft price may be unknown',()=>assert.equal(C.normalise(body()).selling_price,null)],
 ['price precision enforced',()=>assert.throws(()=>C.normalise(body({selling_price:'1.001'})))],
 ['boolean strings rejected',()=>assert.throws(()=>C.normalise(body({is_active:'false'})))],
 ['NaN dimension rejected',()=>assert.throws(()=>C.normalise(body({attributes:{length_mm:NaN}})))],
 ['negative dimension rejected',()=>assert.throws(()=>C.normalise(body({attributes:{height_mm:-1}})))],
 ['unknown attribute rejected',()=>assert.throws(()=>C.normalise(body({attributes:{material:'glass'}})))],
 ['primary must be assigned',()=>assert.throws(()=>C.normalise(body({primary_category_id:B})))],
 ['fixture mode defaults replaceable',()=>assert.equal(C.attributes(fixture,C.normalise(body()).attributes).light_source_mode,'replaceable')],
 ['fixture integrated mode rejected',()=>assert.throws(()=>C.attributes(fixture,C.normalise(body({attributes:{light_source_mode:'integrated'}})).attributes))],
 ['integrated kind fixes source mode',()=>assert.equal(C.attributes(lamp,C.normalise(body()).attributes).light_source_mode,'integrated')],
 ['inactive kind rejected',()=>assert.throws(()=>C.attributes({...fixture,is_active:false},C.normalise(body()).attributes))],
 ['general wattage rejected',()=>assert.throws(()=>C.attributes({...fixture,entry_profile:'general'},C.normalise(body({attributes:{wattage:10}})).attributes))],
 ['preserve tags',()=>assert.deepEqual(C.targetTags([T],[],'preserve'),[T])],
 ['merge tags deduplicates',()=>assert.deepEqual(C.targetTags([T],[T],'merge'),[T])],
 ['explicit empty replacement clears tags',()=>assert.deepEqual(C.targetTags([T],[],'replace'),[])],
])test(name,fn);
function mockDB(activated=true){const calls=[];return {calls,actor:async()=>{calls.push('ACTOR');},transaction:async fn=>{calls.push('BEGIN');try{const out=await fn({query:async(sql,args)=>{calls.push(sql);return {rows:sql.includes('catalogue_taxonomy_versions')&&activated?[{version:3}]:[]};}});calls.push('COMMIT');return out;}catch(e){calls.push('ROLLBACK');throw e;}}};}
test('writer stays closed before cutover activation',async()=>{const db=mockDB(false),s=createTagProductService(db,async()=>{});await assert.rejects(s.transaction({id:A},async()=>{}),e=>e.status===503);assert.equal(db.calls.at(-1),'ROLLBACK');});
test('writer locks before user product work',async()=>{const db=mockDB(),s=createTagProductService(db,async()=>{});await s.transaction({id:A},async()=>{db.calls.push('WORK');});assert.ok(db.calls.indexOf('SELECT pg_advisory_xact_lock(8102403)')<db.calls.indexOf('WORK'));});
test('closed write contexts reject reuse',async()=>{const db=mockDB(),s=createTagProductService(db,async()=>{});let saved;await s.transaction({id:A},async w=>{saved=w;});await assert.rejects(saved.query('SELECT 1'),e=>e.status===409);});
test('caught write validation errors still roll back transaction',async()=>{const db=mockDB(),s=createTagProductService(db,async()=>{});await assert.rejects(s.transaction({id:A},async w=>{try{await w.writeProduct(null,{});}catch(_){}}));assert.equal(db.calls.at(-1),'ROLLBACK');});
test('null category list rejected',()=>assert.throws(()=>C.normalise(body({category_ids:null}))));
test('null tag list rejected',()=>assert.throws(()=>C.normalise(body({tag_ids:null}))));
test('null active flag rejected',()=>assert.throws(()=>C.normalise(body({is_active:null}))));
test('legacy kind string rejected',()=>assert.throws(()=>C.normalise(body({product_kind:'fixture'}))));
function productDB(){const calls=[];let tags=[],attributes=null;const p={id:A,sku:'TEST',name:'Test',product_kind:'fixture',revision:'1',is_active:true};const db={actor:async()=>{},transaction:async fn=>fn({query:async(sql,args)=>{calls.push([sql,args]);if(sql.includes('FROM catalogue_taxonomy_versions'))return {rows:[{version:3}]};if(sql.startsWith('SELECT * FROM product_kinds'))return {rows:[fixture]};if(sql.startsWith('SELECT t.id FROM tags'))return {rows:args[0].map(id=>({id}))};if(sql.startsWith('INSERT INTO products'))return {rows:[{id:A}]};if(sql.startsWith('SELECT * FROM products'))return {rows:[p]};if(sql.startsWith('INSERT INTO product_attributes'))attributes={product_id:A,product_kind_id:A,kind_code:'fixture',entry_profile:'fixture'};if(sql.startsWith('SELECT a.*'))return {rows:attributes?[attributes]:[]};if(sql.startsWith('DELETE FROM product_tags'))tags=tags.filter(id=>args[1].includes(id));if(sql.startsWith('INSERT INTO product_tags'))tags=[...new Set([...tags,...args[1]])];if(sql.startsWith('SELECT t.id,t.code'))return {rows:tags.map(id=>({id,tag_group_id:G,is_active:true,group_active:true}))};return {rows:[]};}})};return {db,calls};}
test('writer emits one set-based tag insert',async()=>{const {db,calls}=productDB(),s=createTagProductService(db,async()=>{}),p=await s.save({id:A},null,body({tag_mode:'replace',tag_ids:[T,B]}));assert.equal(p.tag_ids.length,2);assert.equal(calls.filter(([sql])=>sql.startsWith('INSERT INTO product_tags')).length,1);});
test('writer validates stale revision before updates',async()=>{const {db,calls}=productDB(),s=createTagProductService(db,async()=>{});await assert.rejects(s.save({id:A},A,body(),99),e=>e.status===409);assert.equal(calls.some(([sql])=>sql.startsWith('UPDATE products')),false);});
test('invalid UUID has HTTP 400 status',()=>assert.throws(()=>C.uuid('invalid'),e=>e.status===400&&e.message==='Invalid reference ID'));
test('valid numeric price accepted',()=>assert.equal(C.normalise(body({selling_price:100})).selling_price,'100'));
test('valid decimal string price accepted',()=>assert.equal(C.normalise(body({selling_price:'1250.50'})).selling_price,'1250.50'));
test('zero price accepted',()=>assert.equal(C.normalise(body({selling_price:0})).selling_price,'0'));
test('maximum bounded price accepted',()=>assert.equal(C.normalise(body({selling_price:'999999999999.99'})).selling_price,'999999999999.99'));
test('boolean price rejected with HTTP 400',()=>assert.throws(()=>C.normalise(body({selling_price:false})),e=>e.status===400));
