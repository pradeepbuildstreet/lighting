"use strict";
const multer=require('multer');
const {createService,sendImage,MAX_BYTES}=require('../services/category-images');
function createRouter(express,db,audit){
 const router=express.Router(),service=createService(db,audit),upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_BYTES,files:1,fields:1,fieldSize:100,parts:2}}).single('image');
 router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');if(!req.admin?.id)return res.status(401).json({error:'Admin sign-in required'});next();});
 const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){const status=[400,404,409].includes(e.status)?e.status:503;res.status(status).json({error:status===503?'Category image storage unavailable. Check migration 11 and reload before retrying.':e.message});}};
 router.get('/:id',wrap(async(req,res)=>res.json(await service.metadata(req.params.id))));
 router.get('/:id/content/:revision',wrap(async(req,res)=>sendImage(res,await service.content(req.params.id,req.params.revision))));
 router.put('/:id',(req,res,next)=>upload(req,res,e=>{if(e)return res.status(e.code==='LIMIT_FILE_SIZE'?413:400).json({error:'Upload one JPEG or PNG image up to 5 MB.'});next();}),wrap(async(req,res)=>{if(!req.file)return res.status(400).json({error:'Choose an image file.'});res.json(await service.save(req.admin,req.params.id,req.body.expected_revision,req.file.buffer));}));
 router.delete('/:id',wrap(async(req,res)=>res.json(await service.save(req.admin,req.params.id,req.body?.expected_revision,null))));
 return router;
}
module.exports={createRouter};
