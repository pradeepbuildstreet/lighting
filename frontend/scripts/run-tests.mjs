import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
function discover(folder){
 return fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
  const file=path.join(folder,entry.name);
  if(entry.isDirectory())return discover(file);
  return entry.isFile()&&/\.test\.(?:mjs|cjs)$/.test(entry.name)?[file]:[];
 });
}
const files=['test','tests','app'].flatMap(folder=>discover(path.join(root,folder)));
const required=path.join(root,'app/admin/catalogue/group-review-state.test.mjs');
if(!files.includes(required))throw new Error('Required group-review helper regression missing');
if(!files.length)throw new Error('No frontend test files found');
console.log('Running '+files.length+' frontend test files, including group-review helpers');
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',cwd:root});
if(result.error)throw result.error;
process.exitCode=result.status===null?1:result.status;
