"use strict";
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function discover(folder){
 return fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
  const file=path.join(folder,entry.name);
  if(entry.isDirectory())return discover(file);
  return entry.isFile()&&/\.test\.(?:js|mjs|cjs)$/.test(entry.name)?[file]:[];
 });
}
const files=[...discover(path.join(root,'test')),...discover(path.join(root,'services'))];
for(const required of ['test/catalogue-group-review-policy.test.js','test/catalogue-group-reviews.test.js','test/catalogue-worker-lease.test.js','test/catalogue-worker-binding.test.js','test/catalogue-duplicate-worker.test.js','services/catalogue-stale-audit.test.js']){
 if(!files.includes(path.join(root,required)))throw new Error('Required catalogue regression missing: '+required);
}
if(!files.length)throw new Error('No backend test files found');
console.log('Running '+files.length+' backend test files, including service-level regressions');
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',cwd:root});
if(result.error)throw result.error;
process.exitCode=result.status===null?1:result.status;
