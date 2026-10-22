"use strict";
function createRouters({express,db,appDb,requireAdmin,publicCatalogue,enabled,rateLimit}){
 const service=require('../services/homepage-collections').createService({db,appDb,publicCatalogue}),publicRouter=express.Router(),adminRouter=express.Router();
 const headers=(_req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});next();};
 const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){const status=[400,404,409].includes(e.status)?e.status:e.code==='23505'?409:503;res.status(status).json({error:e.status?e.message:status===409?'Collection slug already exists':'Homepage features temporarily unavailable'});}};
 publicRouter.use(headers);publicRouter.use((_req,res,next)=>enabled()?next():res.status(404).json({error:'Not found'}));
 publicRouter.use(rateLimit({windowMs:60000,limit:90,standardHeaders:'draft-7',legacyHeaders:false}));
 publicRouter.get('/',route(async(_req,res)=>{await publicCatalogue.ready();res.json(await service.homepage());}));
 publicRouter.get('/collections/:slug',route(async(req,res)=>{await publicCatalogue.ready();const page=String(req.query.page??'1');if(!/^[1-9]\d{0,2}$/.test(page))return res.status(400).json({error:'Invalid page'});res.json(await service.publicCollection(req.params.slug,Number(page)));}));
 adminRouter.use(headers);adminRouter.use(requireAdmin);
 adminRouter.get('/collections',route(async(_req,res)=>res.json(await service.list())));
 adminRouter.get('/collections/:id',route(async(req,res)=>res.json(await service.detail(req.params.id))));
 adminRouter.get('/products',route(async(req,res)=>res.json(await service.search(req.query.q??''))));
 adminRouter.get('/enquiry-count/:id',route(async(req,res)=>{const id=require('../services/homepage-collections').id(req.params.id),counts=await service.counts([id]);res.json({product_id:id,enquiry_count:counts.get(id)||0});}));
 adminRouter.post('/resolve-skus',route(async(req,res)=>res.json(await service.resolve(req.body.input))));
 adminRouter.post('/collections',route(async(req,res)=>res.status(201).json(await service.save(null,req.body,req.admin))));
 adminRouter.put('/collections/:id',route(async(req,res)=>res.json(await service.save(req.params.id,req.body,req.admin))));
 return {publicRouter,adminRouter};
}
function mount(app){const express=require('express'),db=require('../db/catalogue'),appDb=require('../db/database');const routers=createRouters({express,db,appDb,publicCatalogue:require('../services/public-catalogue-v1').createService(db),requireAdmin:require('../middleware/require-admin').requireAdmin,enabled:()=>require('./public-catalogue-v1').enabled(process.env),rateLimit:require('express-rate-limit')});app.use('/api/homepage',routers.publicRouter);app.use('/api/admin/homepage',routers.adminRouter);}
module.exports={createRouters,mount};
