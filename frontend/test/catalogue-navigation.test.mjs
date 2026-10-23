import test from 'node:test';
import assert from 'node:assert/strict';
import {pruneEmptyCategories,createInflightLoader} from '../lib/catalogue-navigation.mjs';
const node=(id,count,children=[])=>({id,product_count:count,children});
test('empty leaves removed',()=>assert.deepEqual(pruneEmptyCategories([node('empty',0)]),[]));
test('populated leaf retained',()=>assert.equal(pruneEmptyCategories([node('full',1)])[0].id,'full'));
test('parent retained for populated descendant',()=>assert.equal(pruneEmptyCategories([node('parent',0,[node('child',1)])]).length,1));
test('empty descendant pruned',()=>assert.deepEqual(pruneEmptyCategories([node('parent',1,[node('empty',0)])])[0].children,[]));
test('distinct-product rollup not summed',()=>assert.equal(pruneEmptyCategories([node('parent',1,[node('a',1),node('b',1)])])[0].product_count,1));
test('source tree not mutated',()=>{const tree=[node('parent',1,[node('empty',0)])];pruneEmptyCategories(tree);assert.equal(tree[0].children.length,1);});
test('ten populated categories retained in order',()=>{const input=Array.from({length:10},(_,i)=>node(String(i),1));assert.deepEqual(pruneEmptyCategories(input).map(x=>x.id),input.map(x=>x.id));});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
test('concurrent callers share one request',async()=>{let calls=0;const d=deferred(),load=createInflightLoader(async()=>{calls++;return d.promise;});const a=load(),b=load();await Promise.resolve();assert.equal(calls,1);d.resolve('ok');assert.deepEqual(await Promise.all([a,b]),['ok','ok']);});
test('completed values are not cached',async()=>{let calls=0;const load=createInflightLoader(async()=>++calls);assert.equal(await load(),1);assert.equal(await load(),2);});
test('errors do not poison later requests',async()=>{let calls=0;const load=createInflightLoader(async()=>{if(++calls===1)throw Error('failure');return 'ok';});await assert.rejects(load(),/failure/);assert.equal(await load(),'ok');});
test('already aborted caller does not start request',async()=>{let calls=0;const c=new AbortController();c.abort();const load=createInflightLoader(async()=>++calls);await assert.rejects(load({signal:c.signal}),{name:'AbortError'});assert.equal(calls,0);});
test('one caller abort does not cancel another',async()=>{let signal;const d=deferred(),c=new AbortController(),load=createInflightLoader(options=>{signal=options.signal;return d.promise;});const a=load({signal:c.signal}),b=load();await Promise.resolve();const check=assert.rejects(a,{name:'AbortError'});c.abort();await check;assert.equal(signal.aborted,false);d.resolve('ok');assert.equal(await b,'ok');});
test('last caller abort cancels shared request',async()=>{let signal;const d=deferred(),c=new AbortController(),load=createInflightLoader(options=>{signal=options.signal;return d.promise;});const a=load({signal:c.signal});await Promise.resolve();const check=assert.rejects(a,{name:'AbortError'});c.abort();await check;assert.equal(signal.aborted,true);d.resolve('ignored');});
