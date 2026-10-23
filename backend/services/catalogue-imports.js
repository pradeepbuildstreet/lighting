"use strict";
const crypto=require('node:crypto'),V=require('../validators/catalogue');
const categoryPolicy=require('./category-policy');
function problem(status,message){const e=new Error(message);e.status=status;throw e;}
function createImports(db,products,parseWorkbook){
 async function preview(actor,buffer,mode='create'){
  if(!['create','update','upsert'].includes(mode))V.fail('Invalid import mode');
  const [f,l,categories]=await Promise.all([db.query('SELECT id,code,is_active FROM fixture_types'),db.query('SELECT id,code,is_active FROM light_types'),db.query('SELECT id,name,slug,is_active,allow_direct_products FROM categories')]);
  const parsed=await parseWorkbook(buffer,{fixtures:f.rows,lights:l.rows,categories:categories.rows});
  if(!parsed.length||parsed.length>1000)V.fail('Invalid row count');
  const counts=new Map();for(const r of parsed)if(r.payload)counts.set(r.payload.sku,(counts.get(r.payload.sku)||0)+1);
  return db.transaction(async c=>{
   await db.actor(c,actor);const rows=[];
   for(const r of parsed){
    const errors=[...r.errors];let action='error',staged={},key=r.payload?.sku||null;
    if(!errors.length)try{
     const validated=V.product(r.payload);categoryPolicy.checkCategoryRows(validated.categories,categories.rows);if(counts.get(key)>1)V.fail('SKU repeats in workbook');
     const old=(await c.query('SELECT id,revision,product_kind FROM products WHERE sku=$1',[key])).rows[0];
     if(old&&mode==='create')V.fail('SKU already exists');if(!old&&mode==='update')V.fail('SKU does not exist');if(old&&old.product_kind!==r.payload.product_kind)V.fail('Cannot change product kind');
     action=old?'update':'insert';staged={payload:r.payload,product_id:old?.id||null,expected_revision:old?.revision||null};
    }catch(e){if(e.status!==400)throw e;errors.push(e.message);}
    rows.push({sheet:r.sheet,row_number:r.row_number,record_key:key,action,staged_data:staged,errors});
   }
   const token=crypto.randomBytes(32).toString('hex'),digest=crypto.createHash('sha256').update(buffer).digest('hex');
   const job=(await c.query("INSERT INTO import_jobs(created_by,status,mode,workbook_sha256,preview_revision,expires_at) VALUES($1,'preview',$2,$3,$4,now()+interval '30 minutes') RETURNING *",[actor.id,mode,digest,token])).rows[0];
   for(const r of rows)await c.query('INSERT INTO import_row_results(job_id,sheet,row_number,record_key,action,staged_data,errors) VALUES($1,$2,$3,$4,$5,$6,$7)',[job.id,r.sheet,r.row_number,r.record_key,r.action,r.staged_data,JSON.stringify(r.errors)]);
   await products.audit(c,actor,'import_jobs',job.id,'preview',null,{mode,rows:rows.length});return {job,rows,commit_ready:rows.every(r=>r.action!=='error'),update_semantics:'full_replacement'};
  });
 }
 async function get(actor,id){
  V.uuid(id);const job=(await db.query('SELECT * FROM import_jobs WHERE id=$1 AND created_by=$2',[id,actor.id])).rows[0];if(!job)problem(404,'Import job not found');
  return {job,rows:(await db.query('SELECT * FROM import_row_results WHERE job_id=$1 ORDER BY sheet,row_number',[id])).rows};
 }
 async function commit(actor,id,token,confirm){
  V.uuid(id);if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))V.fail('Invalid preview token');if(confirm!==undefined&&typeof confirm!=='boolean')V.fail('Invalid replacement confirmation');
  return db.transaction(async c=>{
   const job=(await c.query('SELECT *,expires_at<=now() AS expired FROM import_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!job||job.created_by!==actor.id)problem(404,'Import job not found');if(job.preview_revision!==token)problem(409,'Preview token mismatch');
   const rows=(await c.query('SELECT * FROM import_row_results WHERE job_id=$1 ORDER BY sheet,row_number',[id])).rows;
   if(job.status==='committed')return {job_id:id,replayed:true,products:rows.map(r=>r.staged_data.result)};
   if(job.status!=='preview'||job.expired||!rows.length||rows.some(r=>r.action==='error'))problem(409,'Preview is invalid or expired; upload again');
   if(rows.some(r=>r.action==='update')&&!confirm)problem(409,'Confirm full field and category replacement');
   await db.actor(c,actor);await c.query("UPDATE import_jobs SET status='committing' WHERE id=$1",[id]);const results=[];
   for(const r of rows){const s=r.staged_data,p=await products.writeProduct(c,actor,s.product_id,V.product(s.payload),s.expected_revision),result={id:p.id,sku:p.sku,revision:p.revision};results.push(result);await c.query('UPDATE import_row_results SET staged_data=$2 WHERE id=$1',[r.id,{...s,result}]);}
   await c.query("UPDATE import_jobs SET status='committed',committed_at=now() WHERE id=$1",[id]);await products.audit(c,actor,'import_jobs',id,'commit',null,{products:results});return {job_id:id,replayed:false,products:results};
  });
 }
 return {preview,get,commit};
}
module.exports={createImports};
