"use strict";
const V=require("../validators/catalogue");
const categoryPolicy=require('./category-policy');
function createProductService(db){
async function audit(c,actor,entity,id,action,before,after){await c.query('INSERT INTO admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)',[actor.id,action,entity,id,before||null,after||null]);}
async function detail(c,id){
 const p=(await c.query('SELECT * FROM products WHERE id=$1',[id])).rows[0];
 if(!p){const e=new Error('Product not found');e.status=404;throw e;}
 const table=p.product_kind==='fixture'?'fixture_specs':'light_specs';
 const specs=(await c.query(`SELECT * FROM ${table} WHERE product_id=$1`,[id])).rows[0]||{};
 const categories=(await c.query('SELECT category_id,is_primary FROM product_categories WHERE product_id=$1 ORDER BY category_id',[id])).rows;
 return {...p,specs,category_ids:categories.map(x=>x.category_id),primary_category_id:categories.find(x=>x.is_primary)?.category_id||null};
}
async function writeProduct(c,actor,id,data,revision){
 await db.actor(c,actor);
 await categoryPolicy.validateAssignments(c,data.categories);
 let before=null;
 if(id){
  const locked=(await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!locked){const e=new Error('Product not found');e.status=404;throw e;}
  if(locked.product_kind!==data.product_kind)V.fail('Product kind cannot be changed');
  if(String(locked.revision)!==String(revision)){const e=new Error('Product changed since loading. Reload before saving.');e.status=409;throw e;}
  before=await detail(c,id);
  if(data.product_kind==='fixture'){
   const oldMode=before.specs.light_source_mode,newMode=data.spec.light_source_mode;
   if(oldMode!==newMode&&!data.mode_change_confirmed)V.fail('Confirm the light-source mode change explicitly');
   if(newMode==='integrated'&&(await c.query('SELECT id FROM fixture_socket_groups WHERE fixture_product_id=$1 LIMIT 1',[id])).rows.length)V.fail('Remove socket groups explicitly before switching to Integrated');
   if(oldMode!==newMode&&Object.keys(before.specs.inbuilt_specs||{}).length&&!Object.keys(data.spec.inbuilt_specs||{}).length&&!data.mode_change_confirmed)V.fail('Confirm removal of integrated specifications');
  }
 }
 const fields=['sku','name','product_kind','brand','model_number','description','selling_price','currency','is_active'];
 if(!id){id=(await c.query(`INSERT INTO products(${fields.join(',')}) VALUES(${fields.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,fields.map(f=>data[f]))).rows[0].id;}
 else await c.query(`UPDATE products SET ${fields.map((f,i)=>f+'=$'+(i+2)).join(',')},published=false,approved_revision=NULL,approved_by=NULL,approved_at=NULL,review_status='draft' WHERE id=$1`,[id,...fields.map(f=>data[f])]);
 const type=data.product_kind==='fixture'?'fixture_types':'light_types';
 const typeId=data.spec[data.product_kind==='fixture'?'fixture_type_id':'light_type_id'];
 if(!(await c.query(`SELECT id FROM ${type} WHERE id=$1 AND is_active=true`,[typeId])).rows.length)V.fail('Active fixture/light type required');
 const table=data.product_kind==='fixture'?'fixture_specs':'light_specs';const specFields=Object.keys(data.spec);
 await c.query(`INSERT INTO ${table}(product_id,${specFields.join(',')}) VALUES($1,${specFields.map((_,i)=>'$'+(i+2)).join(',')}) ON CONFLICT(product_id) DO UPDATE SET ${specFields.map(f=>f+'=EXCLUDED.'+f).join(',')}`,[id,...specFields.map(f=>data.spec[f])]);
 await c.query('DELETE FROM product_categories WHERE product_id=$1',[id]);
 for(const category of data.categories)await c.query('INSERT INTO product_categories(product_id,category_id,is_primary) VALUES($1,$2,$3)',[id,category,category===data.primary]);
 const after=await detail(c,id);await audit(c,actor,'products',id,before?'update':'create',before,after);return after;
}

return {audit,detail,writeProduct};
}
module.exports={createProductService};
