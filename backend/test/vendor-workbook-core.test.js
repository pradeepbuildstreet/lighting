"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../services/vendor-workbook-core');
const row={sku:'fix100001',vendor_code:'SUPPLIER',vendor_sku:'AAGAM-5434A',list_price:'1000',discount_percent:'20',currency:'INR',price_basis:'tax_exclusive',tax_percent:'18'};
test('normalize product SKU separately from vendor SKU and compute discounted net',()=>{const r=C.normalize(row);assert.equal(r.sku,'FIX100001');assert.equal(r.vendor_sku,'AAGAM-5434A');assert.equal(C.netPrice(r),'800.00');});
test('reject invalid discounts, missing tax basis and non-plain cells',()=>{for(const patch of [{discount_percent:101},{discount_percent:-1},{price_basis:''},{sku:{formula:'A1'}}])assert.throws(()=>C.normalize({...row,...patch}));});
test('signed preview is owner-bound and tamper resistant',()=>{process.env.AUTH_SECRET='x'.repeat(32);const p={type:'vendor-pricing-v1',owner:'admin-a',request_id:'11111111-1111-1111-1111-111111111111',expires:Date.now()+10000,rows:[C.normalize(row)]},t=C.sign(p);assert.equal(C.verify(t,{id:'admin-a'}).owner,'admin-a');assert.throws(()=>C.verify(t,{id:'admin-b'}));assert.throws(()=>C.verify(t.slice(0,-1)+(t.endsWith('0')?'1':'0'),{id:'admin-a'}));});
test('half-cent amounts round to cents without floating-point arithmetic',()=>assert.equal(C.netPrice(C.normalize({...row,list_price:'0.01',discount_percent:'50'})),'0.01'));
