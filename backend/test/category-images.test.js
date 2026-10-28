"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {validateImage,MAX_BYTES,createService}=require('../services/category-images');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXZkAAAAASUVORK5CYII=','base64');
test('accept PNG signature and bounded dimensions',()=>assert.equal(validateImage(png),'image/png'));
test('reject SVG, oversized uploads and invalid dimensions',()=>{for(const bytes of [Buffer.from('<svg/>'),Buffer.alloc(MAX_BYTES+1)])assert.throws(()=>validateImage(bytes));const large=Buffer.from(png);large.writeUInt32BE(10001,16);assert.throws(()=>validateImage(large));});
test('reject stale revisions before writing image bytes',async()=>{let writes=0;const db={actor:async()=>{},transaction:fn=>fn({query:async(sql)=>{if(sql.includes('FOR UPDATE'))return {rows:[{id:'x'}]};if(sql.startsWith('SELECT revision'))return {rows:[{revision:'22222222-2222-2222-2222-222222222222'}]};if(sql.startsWith('INSERT'))writes++;return {rows:[]};}})};await assert.rejects(createService(db,async()=>{}).save({id:'admin'},'11111111-1111-1111-1111-111111111111','none',png),e=>e.status===409);assert.equal(writes,0);});
