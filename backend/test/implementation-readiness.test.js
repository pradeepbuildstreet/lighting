"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {checkImplementationReadiness}=require('../services/implementation-readiness');
function catalogue(overrides={}){return {query:async sql=>({rows:sql.includes('max(version)')?[{version:3,definition:'current_duplicate_approval(id, revision, approved_by, product_kind)',...overrides}]:[]})};}
test('current schema accepted without changing records',async()=>{const calls=[];const app={query:async sql=>{calls.push(sql);return {rows:[]};}};assert.equal((await checkImplementationReadiness(app,catalogue())).ready,true);assert.equal(calls.length,5);assert.ok(calls.every(sql=>sql.startsWith('SELECT')));});
test('missing workflow schema fails even if SELECT 1 would succeed',async()=>{await assert.rejects(checkImplementationReadiness({query:async sql=>{if(sql.includes('wishlist_items')){const e=Error('missing column');e.code='42703';throw e;}return {rows:[]};}},catalogue()),e=>e.connectionCheck==='application'&&e.code==='42703');});
test('old catalogue schema rejected',async()=>{await assert.rejects(checkImplementationReadiness({query:async()=>({rows:[]})},catalogue({version:2})),e=>e.connectionCheck==='catalogue'&&e.code==='CATALOGUE_SCHEMA_NOT_READY');});
test('publication gate absent rejected',async()=>{await assert.rejects(checkImplementationReadiness({query:async()=>({rows:[]})},catalogue({definition:'SELECT * FROM products'})),e=>e.connectionCheck==='catalogue');});
test('missing catalogue specification table rejected',async()=>{await assert.rejects(checkImplementationReadiness({query:async()=>({rows:[]})},{query:async sql=>{if(sql.includes('fixture_specs'))throw Error('missing relation');return {rows:[]};}}),e=>e.connectionCheck==='catalogue');});
