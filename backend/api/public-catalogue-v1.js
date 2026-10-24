"use strict";
const path=require('node:path'),fs=require('node:fs/promises');
function enabled(env = process.env) {
 if (env.PUBLIC_CATALOGUE_ENABLED !== 'true') return false;
 try { require('../config/runtime').loadConfig(env); return true; } catch (_) { return false; }
}
function createRouter(express,db,rateLimit){
 const router=express.Router(),service=require('../services/public-catalogue-v1').createService(db),tagService=require('../services/public-catalogue-tag-filters').createTagListingService(db),root=require('../services/media-storage').getMediaRoot();
 router.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});if(!enabled(process.env))return res.status(404).json({error:'Not found'});if(!['GET','HEAD'].includes(req.method))return res.status(405).set('Allow','GET, HEAD').json({error:'Method not allowed'});next();});
 router.use(rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many requests'}}));
 const wrap=fn=>async(req,res)=>{try{await service.ready();await fn(req,res);}catch(e){const status=[400,404,416].includes(e.status)?e.status:503;console.error(JSON.stringify({event:'public_catalogue_request_failed',code:e.code||String(status)}));if(!res.headersSent)res.status(status).json({error:status===503?'Catalogue temporarily unavailable':status===404?'Not found':status===416?'Invalid media range':e.message});}};
 router.get('/categories',wrap(async(_req,res)=>res.json(await service.categories())));
 router.get('/filters',wrap(async(_req,res)=>res.json(await service.filters())));
 router.get('/tag-filters',wrap(async(req,res)=>res.json(await tagService.facets(req.query))));
 router.get('/products',wrap(async(req,res)=>res.json(await (req.query.tag_filters===undefined?service.list(req.query):tagService.list(req.query)))));
 router.get('/products/id/:id/compatibility',(_req,res)=>res.status(410).set('Cache-Control','no-store').json({error:'Compatibility is assessed in admin; current eligible results use /api/product-insights/compatible-lights/:id'}));
 router.get('/products/id/:id',wrap(async(req,res)=>res.json(await service.detail(req.params.id,true))));
 router.get('/products/:sku',wrap(async(req,res)=>res.json(await service.detail(req.params.sku,false))));
 router.get('/media/:id',wrap(async(req,res)=>{
  const m=await service.media(req.params.id);let folder,file;try{folder=await fs.realpath(root);file=await fs.realpath(path.join(folder,m.storage_key));if(!file.startsWith(folder+path.sep)||!(await fs.stat(file)).isFile())throw Error();}catch(_){const e=new Error('Not found');e.status=404;throw e;}
  const ext=path.extname(m.storage_key).toLowerCase(),types={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'};
  if(!types[ext]||(ext==='.mp4')!==(m.media_type==='video')){const e=new Error('Not found');e.status=404;throw e;}
  res.set({'Content-Type':types[ext],'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"});
  await new Promise((resolve,reject)=>res.sendFile(file,{cacheControl:false,lastModified:false,dotfiles:'deny'},e=>e?reject(e):resolve()));
 }));return router;
}
module.exports={enabled,createRouter};
