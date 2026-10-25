"use strict";
const test=require('node:test'),A=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const id='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222';
function fixture({tagged=true,enabled=true,attributes={product_kind_id:aid},revision='2'}={}){
 const calls=[],records=[{id,revision,product_kind:'fixture',name:'Lamp',is_active:true,review_status:'draft',attributes,tags:[],image_hashes:[]}];
 const query=async(sql,args=[])=>{calls.push({sql,args});A.doesNotMatch(sql,/fixture_specs|light_specs|fixture_types|light_types/);if(sql.startsWith('SELECT * FROM products'))return {rows:[records[0]]};if(sql.startsWith('SELECT EXISTS('))return {rows:[{tag_model:tagged}]};if(sql.includes('FROM catalogue_taxonomy_versions'))return {rows:enabled?[{version:3}]:[]};if(sql.startsWith('SELECT p.* FROM products p ORDER'))return {rows:records};if(sql.startsWith('INSERT INTO product_duplicate_audits'))return {rows:[{id:aid,algorithm_version:args[2]}]};return {rows:[]};};
 const V={uuid:x=>x,num:x=>Number(x),fail:message=>{throw Object.assign(Error(message),{status:400});}};
 const P={tagDigest:rows=>JSON.stringify(rows),assertAlgorithm:()=>{}};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/catalogue-duplicates.js'),'utf8'),{module:mod,require:x=>x==='../validators/catalogue'?V:x==='./catalogue-duplicate-model'?P:require(x)});
 const service=mod.exports.createDuplicateService({transaction:fn=>fn({query}),actor:async()=>{}},{tagScoring:{ALGORITHM:'tags-evidence-v2',loadEvidence:async(_c,rows)=>rows,compare:()=>null}});return {service,calls};
}
const wrote=f=>f.calls.some(x=>/^(INSERT|UPDATE|DELETE)/.test(x.sql));
test('duplicate audit rejects missing tag model before corpus or writes',async()=>{const f=fixture({tagged:false});await A.rejects(f.service.run({id},id,2),e=>e.status===409);A.equal(wrote(f),false);A.ok(!f.calls.some(x=>x.sql.startsWith('SELECT p.* FROM products p ORDER')));});
test('duplicate audit requires tag activation',async()=>{const f=fixture({enabled:false});await A.rejects(f.service.run({id},id,2),e=>e.status===503);A.equal(wrote(f),false);});
test('duplicate evidence must include subject attributes',async()=>{const f=fixture({attributes:null});await A.rejects(f.service.run({id},id,2),e=>e.status===409);A.equal(wrote(f),false);});
test('tag-only audit creates the current algorithm evidence',async()=>{const f=fixture(),r=await f.service.run({id},id,2);A.equal(r.audit.algorithm_version,'tags-evidence-v2');A.ok(f.calls.some(x=>x.sql.startsWith('SELECT p.* FROM products p ORDER')));A.ok(wrote(f));});
test('revision conflict still prevents audit writes',async()=>{const f=fixture({revision:'3'});await A.rejects(f.service.run({id},id,2),e=>e.status===409);A.equal(wrote(f),false);});
test('startup and duplicate modules contain no legacy table identifiers',()=>{for(const file of ['implementation-readiness','catalogue-duplicates'])A.doesNotMatch(fs.readFileSync(path.join(__dirname,'../services/'+file+'.js'),'utf8'),/fixture_specs|light_specs|fixture_types|light_types/);});
