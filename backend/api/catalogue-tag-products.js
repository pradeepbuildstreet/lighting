"use strict";
const C=require('../services/catalogue-tag-product-core');
const PRODUCT_KEYS=new Set(['sku','name','product_kind_id','brand','model_number','description','selling_price','currency','is_active','category_ids','primary_category_id','tag_ids','tag_mode','attributes']);
function payload(body,updating){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['product','expected_revision'].includes(k)))C.fail('Use a product and expected_revision envelope');
 const product=body.product;if(!product||typeof product!=='object'||Array.isArray(product)||Object.keys(product).some(k=>!PRODUCT_KEYS.has(k)))C.fail('Invalid product fields; publication and review fields are not accepted');
 if(updating&&!Object.hasOwn(product,'category_ids'))C.fail('Category assignments are required for replacement updates');
 if(Object.hasOwn(product,'category_ids')){
  if(!Array.isArray(product.category_ids))C.fail('Category assignments must be a list.');
  if(product.category_ids.length>30)C.fail('At most 30 categories per product. Remove a category before adding another.');
 }
 let revision=null;
 if(updating){const v=body.expected_revision;if(typeof v==='number'&&(!Number.isSafeInteger(v)||v<=0))C.fail('Expected revision must be a positive safe integer or integer string');if(!['string','number'].includes(typeof v)||!/^[1-9]\d{0,18}$/.test(String(v))||BigInt(v)>9223372036854775807n)C.fail('Valid expected_revision required');revision=String(v);}
 else if(Object.hasOwn(body,'expected_revision'))C.fail('Create does not accept expected_revision');
 return {product,revision};
}
function createTagProductRouter({express,db,audit,products}){
 const router=express.Router(),service=products||require('../services/catalogue-tag-products').createTagProductService(db,audit);
 const fail=(res,e)=>{const status=[400,401,403,404,409,413,503].includes(e.status)?e.status:['23505','23P01','40001','40P01','55P03'].includes(e.code)?409:['23503','23514','22P02'].includes(e.code)?400:503;return res.status(status).json({error:e.status&&status===e.status?e.message:status===409?'Product or reference conflict; reload before retrying':status===400?'Invalid product reference or field value':'Tag product API unavailable'});};
 const route=fn=>async(req,res)=>{try{C.uuid(req.admin.id);await fn(req,res);}catch(e){fail(res,e);}};
 router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');if(!req.admin?.id)return res.status(401).json({error:'Admin sign-in required'});return next();});
 const stateSql="SELECT EXISTS(SELECT 1 FROM catalogue_taxonomy_versions WHERE version=2) AS storage_ready,EXISTS(SELECT 1 FROM catalogue_taxonomy_versions WHERE version=3) AS activated,to_regprocedure('public.catalogue_product_model_ready(uuid,text)') IS NOT NULL AS publication_ready";
 const ready=s=>s?.storage_ready===true&&s?.activated===true&&s?.publication_ready===true;
 async function context(actor,work){return service.transaction(actor,async w=>{if(!ready((await w.query(stateSql)).rows[0]))C.fail('Tag product storage, publication prerequisite and coordinated activation are required',503);return work(w);});}
 router.get('/state',route(async(_req,res)=>{const state=(await db.query(stateSql)).rows[0]||{};res.json({format_version:2,storage_ready:state.storage_ready===true,publication_ready:state.publication_ready===true,activated:state.activated===true,write_enabled:ready(state),read_enabled:ready(state)});}));
 router.get('/:id',route(async(req,res)=>{const id=C.uuid(req.params.id),product=await context(req.admin,w=>w.detail(id));res.json({product});}));
 router.post('/',route(async(req,res)=>{const {product}=payload(req.body,false),saved=await context(req.admin,w=>w.writeProduct(null,product,null));res.status(201).json({product:saved});}));
 router.put('/:id',route(async(req,res)=>{const id=C.uuid(req.params.id),{product,revision}=payload(req.body,true),saved=await context(req.admin,w=>w.writeProduct(id,product,revision));res.json({product:saved});}));
 return router;
}
module.exports={createTagProductRouter,payload};
