"use strict";
function createPublicationRouter(express,db){
 const router=express.Router(),service=require('../services/catalogue-publication').createPublicationService(db);
 const audit=require('../services/catalogue-products').createProductService(db).audit;
 const operations=require('../services/catalogue-product-operations').createProductOperations(db,audit);
 const wrap=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');await fn(req,res);}catch(e){const status=[400,403,404,409].includes(e.status)?e.status:(e.code==='23514'||e.code==='P0001')?409:503;res.status(status).json({error:status===503?'Catalogue operation unavailable':e.status?e.message:'Database publication prerequisites not satisfied; reload saved state'});}};
 router.get('/product-workspace',wrap(async(req,res)=>{
  const page=Number(req.query.page||1),limit=25,q=String(req.query.q||'').trim().slice(0,200);if(!Number.isSafeInteger(page)||page<1||page>10000){const e=new Error('Invalid page');e.status=400;throw e;}
  const data=await db.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');const where="($1='' OR p.sku ILIKE '%'||$1||'%' OR p.name ILIKE '%'||$1||'%')";const total=Number((await c.query('SELECT count(*) AS total FROM products p WHERE '+where,[q])).rows[0].total);const rows=(await c.query('SELECT p.* FROM products p WHERE '+where+' ORDER BY p.updated_at DESC,p.id LIMIT $2 OFFSET $3',[q,limit,(page-1)*limit])).rows;const visibility=await require('../services/catalogue-visibility').visibilityByIds(c,rows.map(p=>p.id));await require('../services/compatibility-visibility-warnings').attachCompatibilityVisibilityWarnings(c,rows,visibility);return {products:rows.map(p=>({...p,visibility:visibility.get(p.id)})),pagination:{page,limit,total,pages:Math.ceil(total/limit)}};});res.json(data);
 }));
 router.get('/products/:id/operations',wrap(async(req,res)=>res.json({product:await operations.get(req.params.id)})));
 router.patch('/products/:id/operations',wrap(async(req,res)=>res.json({product:await operations.set(req.admin,req.params.id,req.body)})));
 router.get('/products/:id/publication',wrap(async(req,res)=>res.json(await service.readiness(req.params.id))));
 router.post('/products/:id/publication',wrap(async(req,res)=>res.json(await service.set(req.admin,req.params.id,req.body.revision,req.body.published))));
 return router;
}
module.exports={createPublicationRouter};
