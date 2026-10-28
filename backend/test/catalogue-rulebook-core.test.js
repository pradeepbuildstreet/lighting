"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../services/catalogue-rulebook-core');
test('name-rule group ordering is retained',()=>assert.deepEqual(R.validateRule({groups:['finish','style']}).groups,['finish','style']));
test('duplicate, unknown-shape and excessive group rules rejected',()=>{assert.throws(()=>R.validateRule({groups:['a','a']}));assert.throws(()=>R.validateRule({groups:[],script:'bad'}));assert.throws(()=>R.validateRule({maxLength:256}));});
test('brand omission and separators are explicit options',()=>assert.equal(R.validateRule({includeBrand:false,separator:' / '}).includeBrand,false));
test('revision validation preserves bigint precision and new-rule zero',()=>{assert.equal(R.revision('9007199254740993'),'9007199254740993');assert.equal(R.revision('0',true),'0');assert.throws(()=>R.revision('0'));assert.throws(()=>R.revision(9007199254740992));});
