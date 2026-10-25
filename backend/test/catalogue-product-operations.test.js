"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {parseOperation,assertPreserved}=require('../services/catalogue-product-operations');
const expected_token='a'.repeat(32);
test('price-only operations accept zero and two decimal prices',()=>{for(const value of ['0','0.00','123456789012.99',25])assert.equal(parseOperation({operation:'selling_price',value,expected_token}).column,'selling_price');});
test('price validation rejects blank, negative, exponent, excessive precision and null',()=>{for(const value of ['',null,-1,'1e3','1.234','1234567890123',true])assert.throws(()=>parseOperation({operation:'selling_price',value,expected_token}));});
test('active status requires an explicit boolean',()=>{for(const value of [true,false])assert.equal(parseOperation({operation:'active',value,expected_token}).value,value);for(const value of ['true',1,null])assert.throws(()=>parseOperation({operation:'active',value,expected_token}));});
test('unknown fields and stale/missing tokens fail closed',()=>{assert.throws(()=>parseOperation({operation:'active',value:false}));assert.throws(()=>parseOperation({operation:'active',value:false,expected_token,published:false}));});
test('operational changes preserve identity and approval state',()=>{const before={revision:'4',published:true,review_status:'approved',approved_revision:'4',approved_by:'admin',duplicate_of_product_id:null};assert.doesNotThrow(()=>assertPreserved(before,{...before,is_active:false,selling_price:'10'}));for(const [key,value] of [['revision','5'],['published',false],['review_status','draft'],['approved_revision',null],['approved_by',null],['duplicate_of_product_id','other']])assert.throws(()=>assertPreserved(before,{...before,[key]:value}));});
