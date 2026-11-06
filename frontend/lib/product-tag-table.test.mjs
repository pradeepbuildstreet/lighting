import assert from 'node:assert/strict';
import {groupedProductTags} from './product-tag-table.mjs';
const tag=(group_id,group_name,name,filter_attribute=true)=>({group_id,group_name,name,filter_attribute});
const input=[tag('space','Space','Dining'),tag('material','Primary Material','Glass'),tag('space','Space','Kitchen'),tag('space','Space','Living'),tag('material','Primary Material','Metal'),tag('space','Space','Dining'),tag('mount','Mount Type','Ceiling Mounted',false),tag('direction','Light Direction','Multi-Directional',false)];
const before=JSON.stringify(input),rows=groupedProductTags(input,true);
assert.deepEqual(rows.map(r=>r.name),['Space','Primary Material']);assert.equal(rows[0].values.join(', '),'Dining, Kitchen, Living');assert.equal(rows[1].values.join(', '),'Glass, Metal');assert.deepEqual(groupedProductTags(input,false).map(r=>r.name),['Mount Type','Light Direction']);assert.equal(JSON.stringify(input),before);
assert.deepEqual(groupedProductTags([],true),[]);assert.deepEqual(groupedProductTags(null,true),[]);assert.equal(groupedProductTags([tag('a','Style','Modern'),tag('b','Style','Contemporary')],true).length,2);assert.deepEqual(groupedProductTags([tag('a','Style','  Modern  '),tag('a','Style','Modern'),tag('','Style','Bad')],true)[0].values,['Modern']);
console.log('Tag group identity, comma-separated values, ordering, deduplication and section separation tests passed');
