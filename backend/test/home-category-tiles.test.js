'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService,SQL}=require('../services/home-category-tiles');
test('homepage categories retain full paths and use direct category joins',async()=>{
 const queries=[];
 const rows=[{id:'category-1',name:'Chandeliers',slugs:['decorative','ceiling','chandeliers'],product_count:2,media:{id:'11111111-1111-1111-1111-111111111111',media_type:'image',external_url:'https://example.com/chandelier.jpg',is_primary:true,alt_text:'Chandelier',sort_order:0},product_name:'Crystal chandelier'},{id:'category-2',name:'Bulbs',slugs:['bulbs'],product_count:1,media:null}];
 const db={transaction:fn=>fn({query:async sql=>{queries.push(sql);return {rows:sql===SQL?rows:[]};}})};
 const result=await createService(db).tiles();
 assert.equal(result.source,'catalogue');
 assert.equal(result.categories[0].path,'decorative/ceiling/chandeliers');
 assert.equal(result.categories[0].product_count,2);
 assert.equal(result.categories[0].image.url,'https://example.com/chandelier.jpg');
 assert.equal(result.categories[1].image,null);
 assert.equal(queries.length,3);
 assert.match(SQL,/JOIN counts n ON n.category_id=ct.id/);
 assert.match(SQL,/p.category_id=ct.id/);
 assert.doesNotMatch(SQL,/root.id=ANY/);
});
test('empty public catalogue returns an empty tile list',async()=>{
 const db={transaction:fn=>fn({query:async()=>({rows:[]})})};
 assert.deepEqual(await createService(db).tiles(),{source:'catalogue',categories:[]});
});
