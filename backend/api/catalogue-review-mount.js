"use strict";
const V=require('../validators/catalogue');
function mountReviewRoutes(router,express,db,factories={}){
 const duplicateFactory=factories.duplicateFactory||require('./catalogue-duplicates').createDuplicateRouter;
 const publicationFactory=factories.publicationFactory||require('./catalogue-publication').createPublicationRouter;
 router.use(duplicateFactory(express,db));router.use(publicationFactory(express,db));
 router.get('/products/:id/duplicate-audits/latest',async(req,res)=>{
  try{V.uuid(req.params.id);const row=(await db.query('SELECT id FROM product_duplicate_audits WHERE product_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[req.params.id])).rows[0];res.set('Cache-Control','no-store').json({audit_id:row?.id||null});}
  catch(e){res.status(e.status===400?400:503).json({error:e.status===400?e.message:'Audit state unavailable'});}
 });
 return router;
}
module.exports={mountReviewRoutes};
