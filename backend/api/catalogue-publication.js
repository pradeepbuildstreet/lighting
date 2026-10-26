"use strict";
function createPublicationRouter(express,db){
 const router=express.Router(),service=require('../services/catalogue-publication').createPublicationService(db);
 const audit=require('../services/catalogue-products').createProductService(db).audit;
 const operations=require('../services/catalogue-product-operations').createProductOperations(db,audit);
 router.use(require('./catalogue-ordering').createOrderingRouter(express,db,audit));
 router.use(require('./admin-product-browser').createBrowserRouter(express,db));
 const wrap=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');await fn(req,res);}catch(e){const status=[400,403,404,409].includes(e.status)?e.status:(e.code==='23514'||e.code==='P0001')?409:503;res.status(status).json({error:status===503?'Catalogue operation unavailable':e.status?e.message:'Database publication prerequisites not satisfied; reload saved state'});}};
 router.get('/products/:id/operations',wrap(async(req,res)=>res.json({product:await operations.get(req.params.id)})));
 router.patch('/products/:id/operations',wrap(async(req,res)=>{try{res.json({product:await operations.set(req.admin,req.params.id,req.body)});}catch(e){if(['23514','P0001'].includes(e.code)){console.error(JSON.stringify({event:'catalogue_operation_rejected',code:e.code,constraint:e.constraint||null}));e.status=400;e.message='This operation was rejected by a product validation rule. No product changes were committed. Reload current validation before retrying.';}throw e;}}));
 router.get('/products/:id/publication',wrap(async(req,res)=>res.json(await service.readiness(req.params.id))));
 router.post('/products/:id/publication',wrap(async(req,res)=>res.json(await service.set(req.admin,req.params.id,req.body.revision,req.body.published))));
 return router;
}
module.exports={createPublicationRouter};
