import assert from 'node:assert/strict';
import {validDiscount,discountValue,discountDirty,discountChanges,discountAmount} from './admin-discount-selection.mjs';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',row={id,default_discount_percent:'10.00',selling_price:'1000.00',edit_token:'a'.repeat(32)};
assert.equal(discountValue(row,{}),'10.00');assert.equal(discountDirty(row,{[id]:'10'}),false);assert.deepEqual(discountChanges([row],{[id]:'10'}),[]);assert.equal(discountChanges([row],{[id]:'20'})[0].expected_token,row.edit_token);assert.equal(discountAmount(row,'20'),800);assert.equal(discountAmount(row,'100'),0);assert.equal(discountAmount({...row,selling_price:null},'20'),null);
for(const v of ['', '-1','101','1.234','NaN']){assert.equal(validDiscount(v),false);assert.throws(()=>discountChanges([row],{[id]:v}));}
assert.throws(()=>discountChanges([row,row],{}));assert.throws(()=>discountChanges([{...row,edit_token:''}],{[id]:'20'}));assert.equal(row.default_discount_percent,'10.00');
console.log('Shared discount selection, exact-change, token and preview-price tests passed');
