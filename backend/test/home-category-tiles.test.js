"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {createService,SQL}=require('../services/home-category-tiles');
test('use category-owned images and preserve full nested category paths',async()=>{
 const rows=[{id:'11111111-1111-1111-1111-111111111111',name:'Chandeliers',slugs:['decorative','ceiling','chandeliers'],product_count:2,revision:'22222222-2222-2222-2222-222222222222'},{id:'33333333-3333-3333-3333-333333333333',name:'Bulbs',slugs:['bulbs'],product_count:1,revision:null}];
 const db={transaction:fn=>fn({query:async sql=>({rows:sql===SQL?rows:[]})})};const result=await createService(db).tiles();assert.equal(result.categories[0].path,'decorative/ceiling/chandeliers');assert.equal(result.categories[0].image.url,'/api/catalogue/category-images/'+rows[0].id+'/'+rows[0].revision);assert.equal(result.categories[1].image,null);assert.match(SQL,/JOIN counts n ON n.category_id=ct.id/);assert.doesNotMatch(SQL,/product_media/);
});
test('empty public catalogue returns no tiles',async()=>{const db={transaction:fn=>fn({query:async()=>({rows:[]})})};assert.deepEqual(await createService(db).tiles(),{source:'catalogue',categories:[]});});
