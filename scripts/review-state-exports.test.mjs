import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as runtime from '../frontend/app/admin/catalogue/review-state.mjs';
test('review-state declarations match all runtime function exports',()=>{
 const declaration=readFileSync(new URL('../frontend/app/admin/catalogue/review-state.d.mts',import.meta.url),'utf8');
 const declared=[...declaration.matchAll(/^export function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(match=>match[1]).sort();
 const exported=Object.keys(runtime).filter(name=>typeof runtime[name]==='function').sort();
 assert.deepEqual(declared,exported,'Keep review-state.d.mts synchronized with review-state.mjs');
});
test('reviewBlockReason remains available as a named runtime export',()=>{
 assert.equal(typeof runtime.reviewBlockReason,'function');
 assert.equal(runtime.reviewBlockReason({status:'completed',product_revision:8},{sku:'FIX100018',name:'Subject',revision:8},[],false),'');
});
