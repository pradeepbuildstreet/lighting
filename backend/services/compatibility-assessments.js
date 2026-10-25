"use strict";
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value){if(typeof value!=='string'||!UUID.test(value))throw Object.assign(Error('Valid UUID required'),{status:400});return value.toLowerCase();}
function stable(value){if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
function fingerprint(snapshot){return crypto.createHash('sha256').update(JSON.stringify(stable({policy:1,snapshot}))).digest('hex');}
function retired(){throw Object.assign(Error('Compatibility is unavailable pending the tag-model rebuild.'),{status:410,code:'COMPATIBILITY_REBUILD_REQUIRED'});}
async function snapshot(){return retired();}
function assess(){return retired();}
function createService(){return {status:async()=>retired(),run:async()=>retired(),publicResults:async()=>retired()};}
function mount(app){
 const express=require('express'),{requireAdmin}=require('../middleware/require-admin'),rateLimit=require('express-rate-limit'),admin=express.Router(),pub=express.Router();
 const headers=(_req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});next();};
 const reply=(_req,res)=>res.status(410).json({error:'Compatibility is unavailable pending the tag-model rebuild.',code:'COMPATIBILITY_REBUILD_REQUIRED',status:'unavailable',groups:[]});
 admin.use(headers);admin.use(requireAdmin);admin.all(['/:id','/:id/assess'],reply);
 pub.use(headers);pub.use((_req,res,next)=>require('../api/public-catalogue-v1').enabled(process.env)?next():res.status(404).json({error:'Not found'}));pub.use(rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-7',legacyHeaders:false}));pub.all('/:id',reply);
 app.use('/api/admin/compatibility-assessments',admin);app.use('/api/product-insights/compatible-lights',pub);
}
module.exports={id,stable,fingerprint,snapshot,assess,createService,mount};
