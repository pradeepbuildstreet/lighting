'use strict';
const { percent, discounted } = require('./product-discount-core');
const RULE_VERSION = 'interior-incremental-v1';
function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function money(value) {
  if (!['number', 'string'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) invalid('Money must be a non-negative decimal with at most two decimal places');
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result)) invalid('Money exceeds supported range');
  return result;
}
function safe(value) { if (!Number.isSafeInteger(value) || value < 0) invalid('Pricing exceeds supported range'); return value; }
function packageDiscountPaise(subtotalPaise, distinctProducts) {
  safe(subtotalPaise);
  if (!Number.isSafeInteger(distinctProducts) || distinctProducts < 0) invalid('Invalid distinct product count');
  if (distinctProducts < 3 || subtotalPaise < 4000000) return 0;
  if (subtotalPaise <= 6000000) return 200000 + Math.round((subtotalPaise - 4000000) * 0.075);
  return safe(350000 + Math.round((subtotalPaise - 6000000) * 0.10));
}
// Internal pricing service only. Callers must load canonical prices, discounts,
// package membership and availability on the server, never from customer input.
// Unselectable/unavailable lines must be excluded before calling this function.
// Only authorized quotation handlers may supply consolidatedDiscount.
function priceInteriorPackage(lines, consolidatedDiscount = { type: 'amount', value: 0 }) {
  if (!Array.isArray(lines)) invalid('Lines must be an array');
  const seen = new Set();
  let listTotal = 0;
  let subtotal = 0;
  const pricedLines = lines.map(line => {
    if (!line || typeof line.productId !== 'string' || !line.productId.trim()) invalid('Product ID required');
    const productId = line.productId.trim();
    if (seen.has(productId)) invalid('Duplicate product lines must be consolidated');
    seen.add(productId);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) invalid('Quantity must be a positive integer');
    const unitListPaise = money(line.unitListPrice);
    const productDiscountPercent = percent(line.productDiscountPercent);
    const unitNetPaise = money(discounted(unitListPaise / 100, productDiscountPercent).toFixed(2));
    const lineListPaise = safe(unitListPaise * line.quantity);
    const lineNetPaise = safe(unitNetPaise * line.quantity);
    listTotal = safe(listTotal + lineListPaise);
    subtotal = safe(subtotal + lineNetPaise);
    return { productId, quantity: line.quantity, unitListPaise, productDiscountPercent, unitNetPaise, lineListPaise, lineNetPaise };
  });
  const packageDiscount = packageDiscountPaise(subtotal, seen.size);
  const netPackage = subtotal - packageDiscount;
  if (!consolidatedDiscount || !['amount', 'percent'].includes(consolidatedDiscount.type)) invalid('Invalid consolidated discount type');
  const consolidated = consolidatedDiscount.type === 'percent'
    ? Math.round(netPackage * Number(percent(consolidatedDiscount.value)) / 100)
    : money(consolidatedDiscount.value);
  if (consolidated > netPackage) invalid('Consolidated discount exceeds net package value');
  return {
    ruleVersion: RULE_VERSION, currency: 'INR', moneyUnit: 'paise', lines: pricedLines,
    distinctProductCount: seen.size, packageDiscountEligible: seen.size >= 3 && subtotal >= 4000000,
    listTotalPaise: listTotal, productDiscountPaise: listTotal - subtotal,
    subtotalPaise: subtotal, packageDiscountPaise: packageDiscount, netPackagePaise: netPackage,
    consolidatedDiscount: { type: consolidatedDiscount.type, value: String(consolidatedDiscount.value) },
    consolidatedDiscountPaise: consolidated, finalTotalPaise: netPackage - consolidated
  };
}
module.exports = { RULE_VERSION, packageDiscountPaise, priceInteriorPackage };
