"use strict";
function createImportRouter({express,multer,db,products,parseWorkbook}){
 const imports=require('../services/catalogue-imports').createImports(db,products,parseWorkbook),router=express.Router();
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5242880,files:1,fields:1,parts:2,fieldSize:32}}).single('file');
 const fail=(res,e)=>{const status=[400,403,404,409,413].includes(e.status)?e.status:503;res.status(status).json({error:status===503?'Catalogue import unavailable':e.message});};
 router.post('/imports/upload',(req,res)=>upload(req,res,async e=>{
  if(e)return res.status(e.code==='LIMIT_FILE_SIZE'?413:400).json({error:'Invalid or oversized upload'});
  try{if(!req.file||!req.file.originalname.toLowerCase().endsWith('.xlsx')){const e=new Error('Upload an XLSX workbook');e.status=400;throw e;}res.set('Cache-Control','no-store').status(201).json(await imports.preview(req.admin,req.file.buffer,req.body?.mode||'create'));}catch(e){fail(res,e);}
 }));
 router.get('/imports/:id',async(req,res)=>{try{res.set('Cache-Control','no-store').json(await imports.get(req.admin,req.params.id));}catch(e){fail(res,e);}});
 router.post('/imports/:id/commit',async(req,res)=>{try{res.set('Cache-Control','no-store').json(await imports.commit(req.admin,req.params.id,req.body.preview_revision,req.body.confirm_replacement));}catch(e){fail(res,e);}});
 return router;
}
module.exports={createImportRouter};
