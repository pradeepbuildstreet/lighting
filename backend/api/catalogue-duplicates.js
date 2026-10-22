"use strict";
function createDuplicateRouter(express,db){
 const service=require('../services/catalogue-duplicates').createDuplicateService(db),router=express.Router();
 const route=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');await fn(req,res);}catch(e){const status=[400,403,404,409].includes(e.status)?e.status:503;res.status(status).json({error:status===503?'Duplicate review unavailable':e.message});}};
 // Mount after the existing requireAdmin middleware, never as a public router.
 router.get('/duplicates/queue',route(async(_req,res)=>res.json(await service.queue())));
 router.post('/products/:id/duplicate-audits',route(async(req,res)=>res.status(201).json(await service.run(req.admin,req.params.id,req.body.revision))));
 router.get('/duplicate-audits/:id',route(async(req,res)=>res.json(await service.detail(req.params.id))));
 router.post('/duplicate-audits/:id/review',route(async(req,res)=>res.status(201).json(await service.review(req.admin,req.params.id,req.body.decision,req.body.notes,req.body.duplicate_of_product_id))));
 return router;
}
module.exports={createDuplicateRouter};
