import assert from 'node:assert/strict';
import {taggedListQuery,taggedPageHref} from './catalogue-tag-filter-model.mjs';
import {draftFromQuery,editFilters,clearFilters,removeFilter,selectionCount} from './catalogue-filter-workspace.mjs';
const allowed=['q','search','category','kind','brand','currency','min_price','max_price','sort','page','limit'];
function legacyBuild(input){const p=input instanceof URLSearchParams?new URLSearchParams(input):new URLSearchParams(Object.entries(input).filter(([,v])=>v!==undefined&&v!==''));for(const key of p.keys())assert(allowed.includes(key),'Unexpected legacy field '+key);if(!p.has('page'))p.set('page','1');return p;}
function legacyPage(path,input,page){const p=legacyBuild(input);p.set('page',String(page));return path+'?'+p;}
const query={q:'lamp',category:'pendants',discount_status:'discounted',min_discount:'12.50',max_discount:'100'};
const p=taggedListQuery(query,legacyBuild);assert.equal(p.get('min_discount'),'12.5');assert.equal(p.get('discount_status'),'discounted');assert.equal(query.min_discount,'12.50');
const page=new URL(taggedPageHref('/products',query,3,legacyBuild,legacyPage),'https://test.invalid');assert.equal(page.searchParams.get('page'),'3');assert.equal(page.searchParams.get('discount_status'),'discounted');assert.equal(page.searchParams.get('q'),'lamp');assert.equal(page.searchParams.get('max_discount'),'100');
assert.equal(taggedListQuery({discount_status:'all'},legacyBuild).has('discount_status'),false);
assert.equal(taggedListQuery({discount_status:'none',max_discount:'0.00'},legacyBuild).get('max_discount'),'0');
for(const input of [{discount_status:'invalid'},{min_discount:'101'},{min_discount:'10',max_discount:'5'},{max_discount:'1.234'},{discount_status:['none']},new URLSearchParams('min_discount=1&min_discount=2')])assert.throws(()=>taggedListQuery(input,legacyBuild));
assert.equal(draftFromQuery(query).min_discount,'12.50');assert.equal(editFilters(query,{brand:'Clara'}).discount_status,'discounted');assert.equal(removeFilter(query,'discount').q,'lamp');assert.equal(removeFilter(query,'discount').min_discount,'');assert.equal(clearFilters(query,'pendants').discount_status,'');assert.equal(clearFilters(query,'pendants').category,'pendants');assert.equal(selectionCount({discount_status:'discounted'}),1);assert.equal(selectionCount({discount_status:'all'}),0);
const group='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',tag='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';const combined=taggedListQuery({...query,tag_filters:JSON.stringify([{group_id:group,tag_ids:[tag],unclassified:false}])},legacyBuild);assert.equal(JSON.parse(combined.get('tag_filters'))[0].tag_ids[0],tag);assert.equal(combined.get('discount_status'),'discounted');
console.log('Customer discount query, pagination, draft, chip removal and clear-filter tests passed');
