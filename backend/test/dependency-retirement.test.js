"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pkg=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../package.json'),'utf8')),lock=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../package-lock.json'),'utf8'));
test('unused Supabase direct dependency removed',()=>assert.equal(pkg.dependencies['@supabase/supabase-js'],undefined));
test('lock root dependencies match manifest',()=>assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies));
test('exclusive Supabase nodes pruned',()=>{assert.ok(!Object.keys(lock.packages).some(k=>k.includes('node_modules/@supabase/')));assert.equal(lock.packages['node_modules/iceberg-js'],undefined);});
test('shared dependencies retained',()=>{for(const n of ['tslib','pg','bcryptjs','express','exceljs','pdfkit'])assert.ok(lock.packages['node_modules/'+n],n);});
test('real test/preflight commands configured',()=>{assert.equal(pkg.scripts.test,'node scripts/run-tests.js');assert.equal(pkg.scripts['retirement:preflight'],'node scripts/catalogue-retirement-preflight.js');});
