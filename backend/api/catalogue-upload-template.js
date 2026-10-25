"use strict";
function createTemplateRouter(express,db){
 const router=express.Router();
 // Mount after requireAdmin. Do not load the legacy template generator.
 router.all('/imports/template',(_req,res)=>res.set('Cache-Control','private, no-store').status(410).json({
  error:'The legacy workbook template is retired. Download the tag-model v2 template instead.',
  code:'LEGACY_TEMPLATE_RETIRED',
  template_url:'/api/admin/catalogue/taxonomy/imports-v2/template'
 }));
 return router;
}
module.exports={createTemplateRouter};
