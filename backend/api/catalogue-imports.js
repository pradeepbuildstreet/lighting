"use strict";
function createImportRouter({express}){
 const router=express.Router();
 // Authentication is provided by the parent catalogue router.
 router.all(['/imports','/imports/*'],(_req,res)=>res.set('Cache-Control','private, no-store').status(410).json({
  error:'Legacy structured imports are retired. Use a tag-model v2 workbook and the version-2 import workflow.',
  code:'LEGACY_IMPORT_RETIRED',
  replacement_base:'/api/admin/catalogue/taxonomy/imports-v2',
  template_url:'/api/admin/catalogue/taxonomy/imports-v2/template'
 }));
 return router;
}
module.exports={createImportRouter};
