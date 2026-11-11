'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {selection}=require('../api/interior-public');
const id='11111111-1111-4111-8111-111111111111';
test('accept identity and quantity only',()=>{assert.deepEqual(selection([{product_id:id,quantity:3}]),[{product_id:id,quantity:3}]);assert.deepEqual(selection([]),[]);});
test('reject client-controlled price and consolidated discounts',()=>{for(const key of ['price','product_discount_percent','consolidatedDiscount'])assert.throws(()=>selection([{product_id:id,quantity:1,[key]:0}]));});
test('reject duplicate selections and invalid quantities',()=>{assert.throws(()=>selection([{product_id:id,quantity:1},{product_id:id,quantity:2}]));for(const quantity of [0,-1,1.5,'2',10001])assert.throws(()=>selection([{product_id:id,quantity}]));assert.throws(()=>selection([{product_id:'invalid',quantity:1}]));});
