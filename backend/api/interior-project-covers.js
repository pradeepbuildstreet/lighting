'use strict';
const {uuid}=require('../services/public-catalogue-v1');
function fail(status,message){throw Object.assign(Error(message),{status});}
function attach(router,{express,db}){
 const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){console.error('[interior-project-covers]',e.code||e.status||'ERROR');res.status([400,404,409,413].includes(e.status)?e.status:503).json({error:e.status?e.message:'Cover operation unavailable. Reload saved state before retrying.'});}};
 router.get('/projects/:id/cover',wrap(async(req,res)=>{const key=uuid(req.params.id);const project=(await db.query('SELECT id,name,revision FROM interior_projects WHERE id=$1',[key])).rows[0];if(!project)fail(404,'Project not found');const cover=(await db.query('SELECT caption,revision,content_type,octet_length(image_data) AS size FROM interior_project_covers WHERE project_id=$1',[key])).rows[0]||null;res.json({project,cover});}));
 router.get('/projects/:id/cover/file',wrap(async(req,res)=>{const row=(await db.query('SELECT content_type,image_data FROM interior_project_covers WHERE project_id=$1',[uuid(req.params.id)])).rows[0];if(!row)fail(404,'Cover not found');res.set('Content-Security-Policy',"default-src 'none'; sandbox");res.type(row.content_type).send(row.image_data);}));
 router.put('/projects/:id/cover',express.raw({type:['image/jpeg','image/png','image/webp'],limit:'10mb'}),wrap(async(req,res)=>{
  const key=uuid(req.params.id),rev=String(req.query.revision||''),caption=req.query.caption??'';
  if(!/^[1-9]\d*$/.test(rev)||typeof caption!=='string'||caption.length>1000)fail(400,'Invalid revision or caption');
  if(!Buffer.isBuffer(req.body)||!req.body.length||req.body.length>10485760)fail(400,'Select a JPEG, PNG or WebP image of at most 10 MiB');
  const type=require('./interior-admin').imageType(req.body);if(req.get('content-type')?.split(';')[0]!==type)fail(400,'Image content does not match its declared type');
  const receipt=await db.transaction(async c=>{const actor=await db.actor(c,req.admin);const p=(await c.query('SELECT revision FROM interior_projects WHERE id=$1 FOR UPDATE',[key])).rows[0];if(!p)fail(404,'Project not found');if(String(p.revision)!==rev)fail(409,'Project changed. Reload before uploading');const before=(await c.query('SELECT caption,revision,content_type FROM interior_project_covers WHERE project_id=$1',[key])).rows[0]||null;const cover=(await c.query('INSERT INTO interior_project_covers(project_id,content_type,image_data,caption) VALUES($1,$2,$3,$4) ON CONFLICT(project_id) DO UPDATE SET content_type=EXCLUDED.content_type,image_data=EXCLUDED.image_data,caption=EXCLUDED.caption,revision=gen_random_uuid(),updated_at=now() RETURNING caption,revision,content_type',[key,type,req.body,caption.trim()])).rows[0];const project=(await c.query('UPDATE interior_projects SET revision=revision+1,updated_at=now() WHERE id=$1 RETURNING id,name,revision',[key])).rows[0];await c.query('INSERT INTO interior_admin_audit(actor_id,action,entity_type,entity_id,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6)',[actor.id,'upload_project_cover','projects',key,before?JSON.stringify(before):null,JSON.stringify(cover)]);return {project,cover};});res.json(receipt);
 }));
 router.use((error,_req,res,next)=>{if(error.type==='entity.too.large')return res.status(413).json({error:'Maximum cover size is 10 MiB'});next(error);});
}
module.exports={attach};
