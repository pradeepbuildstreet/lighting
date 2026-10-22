"use strict";
function createTemplateRouter(express,db){
 const router=express.Router(),{createBuffer}=require('../services/catalogue-upload-template');
 // Mount AFTER existing requireAdmin; no DB credentials enter the workbook.
 router.get('/imports/template',async(_req,res)=>{
  try{const buffer=await createBuffer(db);res.set('Cache-Control','no-store');res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition','attachment; filename="catalogue-products-'+new Date().toISOString().slice(0,10)+'.xlsx"');res.send(buffer);}
  catch(e){console.error(JSON.stringify({event:'catalogue_template_failed',code:e.code||'TEMPLATE_ERROR'}));res.status(503).json({error:'Unable to generate workbook. Check reference data and catalogue connection.'});}
 });return router;
}
module.exports={createTemplateRouter};
