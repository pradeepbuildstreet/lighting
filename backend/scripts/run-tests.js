"use strict";
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const folder=path.resolve(__dirname,'../test');
const files=fs.readdirSync(folder).filter(n=>/\.test\.(?:js|mjs)$/.test(n)).sort().map(n=>path.join(folder,n));
if(!files.length)throw new Error('No backend test files found');
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status===null?1:result.status;
