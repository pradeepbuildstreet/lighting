"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function load(){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/catalogue-pipeline.js'),'utf8'),{module,require:()=>({})});return module.exports;}
test('pipeline filters have bounded defaults',()=>{const f=load().filters;assert.equal(f({}).page,1);assert.equal(f({q:'x'.repeat(300)}).q.length,200);});
test('validation and manual activation filters are explicit',()=>{const f=load().filters;assert.equal(f({check:'dealer_pricing',active:'false'}).check,'dealer_pricing');assert.equal(f({active:'false'}).active,'false');});
test('invalid filters fail closed',()=>{const f=load().filters;for(const q of [{page:'-1'},{page:'1.5'},{page:'100001'},{check:'unknown'},{active:'yes'}])assert.throws(()=>f(q));});
