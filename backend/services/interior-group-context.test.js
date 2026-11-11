'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {captureGroup}=require('./interior-group-context');
const id='11111111-1111-4111-8111-111111111111';
const design={layout_id:'layout',project_id:'project',grouping_enabled:true,group_label:'Block'};
test('capture validated label and name',async()=>{const client={query:async(sql,args)=>{assert.deepEqual(args,['layout',id,'project']);assert.match(sql,/g.published/);return {rows:[{id,name:'Orchid'}]};}};assert.deepEqual(await captureGroup(client,design,id),{group_id:id,group_name:'Orchid',group_label:'Block'});});
test('reject unassigned or unpublished group',async()=>{await assert.rejects(captureGroup({query:async()=>({rows:[]})},design,id),e=>e.status===409);});
test('reject group when grouping is disabled',async()=>{await assert.rejects(captureGroup({}, {...design,grouping_enabled:false},id),e=>e.status===409);});
test('ungrouped enquiries remain supported without a group lookup',async()=>{assert.deepEqual(await captureGroup({}, {...design,grouping_enabled:false},null),{group_id:null,group_name:null,group_label:null});});
