"use strict";
const assert=require('node:assert/strict');
const {makeBase,buildBrowserQuery,keys}=require('./pipeline-browser-query');
const core={normalise:input=>({...input,page:2,limit:25}),buildWhere:()=>({prefix:'',where:'p.is_active=$1::boolean AND p.default_discount_percent>=$2::numeric',values:[false,'10']})};
const q=buildBrowserQuery({pipeline_check:'identity',pipeline_release:'inactive_blocked',active:'false',min_discount:'10'},core);
assert.deepEqual(q.countArgs,[false,'10','identity','inactive_blocked']);assert.deepEqual(q.pageArgs,[false,'10','identity','inactive_blocked',25,25]);assert(q.pageSql.includes('LIMIT $5::integer OFFSET $6::integer'));assert(q.cte.includes('WHERE p.is_active=$1::boolean'));assert(q.countSql.includes('checks->>$3::text'));assert(q.countSql.includes("$4::text='inactive_blocked'"));assert(q.cte.includes('public.catalogue_saleability_ready'));assert(q.cte.includes('md5(to_jsonb(p)::text)'));assert.equal(keys.length,7);
const category=makeBase('p.id=$2::uuid','WITH RECURSIVE browse_categories AS (SELECT $1::uuid AS id) ');assert(category.startsWith('WITH RECURSIVE browse_categories AS (SELECT $1::uuid AS id), items AS ('));
for(const bad of [{pipeline_check:'injected'},{pipeline_release:'bad'},{pipeline_check:[]},{pipeline_release:true},[]])assert.throws(()=>buildBrowserQuery(bad,core),{status:400});
console.log('Pipeline browser query composition, bind offsets, recursive scope and special-filter validation tests passed');
