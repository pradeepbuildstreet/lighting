"use strict";
function createPublicationRouter(express,db){
 const router=express.Router(),service=require('../services/catalogue-publication').createPublicationService(db);
 const wrap=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');await fn(req,res);}catch(e){const status=[400,403,404,409].includes(e.status)?e.status:(e.code==='23514'||e.code==='P0001')?409:503;res.status(status).json({error:status===503?'Publication unavailable':e.status?e.message:'Database publication prerequisites not satisfied'});}};
 // Mount only after the existing catalogue requireAdmin middleware.
 router.get('/products/:id/publication',wrap(async(req,res)=>res.json(await service.readiness(req.params.id))));
 router.post('/products/:id/publication',wrap(async(req,res)=>res.json(await service.set(req.admin,req.params.id,req.body.revision,req.body.published))));
 return router;
}
module.exports={createPublicationRouter};
