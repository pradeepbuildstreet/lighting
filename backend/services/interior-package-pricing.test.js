'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { packageDiscountPaise, priceInteriorPackage } = require('./interior-package-pricing');
function lines() {
  return [
    { productId: 'a', quantity: 1, unitListPrice: 60000, productDiscountPercent: 20 },
    { productId: 'b', quantity: 1, unitListPrice: 40000, productDiscountPercent: 0 },
    { productId: 'c', quantity: 1, unitListPrice: 20000, productDiscountPercent: 40 }
  ];
}
test('incremental slabs including uncapped final band', () => {
  for (const [subtotal, expected] of [[0,0],[39999.99,0],[40000,2000],[50000,2750],[60000,3500],[80000,5500],[100000,7500],[150000,12500],[200000,17500]]) {
    assert.equal(packageDiscountPaise(Math.round(subtotal * 100), 3), expected * 100);
  }
  assert.equal(packageDiscountPaise(4000001, 3), 200000);
  assert.equal(packageDiscountPaise(6000010, 3), 350001);
});
test('three distinct products required, not quantity', () => {
  assert.equal(packageDiscountPaise(20000000, 2), 0);
  const result = priceInteriorPackage([{ productId: 'a', quantity: 3, unitListPrice: 50000, productDiscountPercent: 0 }]);
  assert.equal(result.distinctProductCount, 1);
  assert.equal(result.packageDiscountPaise, 0);
});
test('product, package, and consolidated discounts are separate', () => {
  const result = priceInteriorPackage(lines(), { type: 'amount', value: 2500 });
  assert.equal(result.listTotalPaise, 12000000);
  assert.equal(result.productDiscountPaise, 2000000);
  assert.equal(result.subtotalPaise, 10000000);
  assert.equal(result.packageDiscountPaise, 750000);
  assert.equal(result.netPackagePaise, 9250000);
  assert.equal(result.consolidatedDiscountPaise, 250000);
  assert.equal(result.finalTotalPaise, 9000000);
});
test('percentage consolidated discount uses net package value', () => {
  const result = priceInteriorPackage(lines(), { type: 'percent', value: 10 });
  assert.equal(result.consolidatedDiscountPaise, 925000);
  assert.equal(result.finalTotalPaise, 8325000);
});
test('empty selection and full consolidated discount', () => {
  assert.equal(priceInteriorPackage([]).finalTotalPaise, 0);
  assert.equal(priceInteriorPackage(lines(), { type: 'percent', value: 100 }).finalTotalPaise, 0);
});
test('reject duplicate products, invalid quantities, and invalid discounts', () => {
  assert.throws(() => priceInteriorPackage([lines()[0], lines()[0]]));
  for (const quantity of [0, -1, 1.5, '2']) assert.throws(() => priceInteriorPackage([{ ...lines()[0], quantity }]));
  assert.throws(() => priceInteriorPackage([{ ...lines()[0], productDiscountPercent: 101 }]));
  assert.throws(() => priceInteriorPackage([{ ...lines()[0], unitListPrice: -1 }]));
  assert.throws(() => priceInteriorPackage(lines(), { type: 'amount', value: 92500.01 }));
  assert.throws(() => priceInteriorPackage(lines(), { type: 'percent', value: 101 }));
  assert.throws(() => priceInteriorPackage(lines(), { type: 'unknown', value: 0 }));
});
