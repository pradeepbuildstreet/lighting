'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validate,digest}=require('../api/interior-enquiries');
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const input=()=>({request_key:id,design_id:id,products:[{product_id:id,quantity:1},{product_id:other,quantity:2}],name:'Example Customer',mobile_number:'9876543210',email:'',pin_code:'600001',requirements:''});
test('canonical enquiry normalizes customer and product order',()=>{const a=input(),b={...a,products:[...a.products].reverse(),mobile_number:'+91 9876543210'};assert.equal(digest(validate(a)),digest(validate(b)));assert.equal(validate(a).mobile_number,'+919876543210');});
test('reject client pricing, empty selections and invalid customer data',()=>{assert.throws(()=>validate({...input(),pricing:{finalTotalPaise:1}}));assert.throws(()=>validate({...input(),products:[]}));assert.throws(()=>validate({...input(),products:[{product_id:id,quantity:1,price:1}]}));assert.throws(()=>validate({...input(),mobile_number:'123'}));assert.throws(()=>validate({...input(),pin_code:'000000'}));assert.throws(()=>validate({...input(),email:'bad'}));});
