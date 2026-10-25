"use strict";
function createProductService(db){
 async function audit(c,actor,entity,id,action,before,after){await c.query('INSERT INTO admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)',[actor.id,action,entity,id,before||null,after||null]);}
 async function detail(c,id){
  const p=(await c.query('SELECT * FROM products WHERE id=$1',[id])).rows[0];
  if(!p){const e=new Error('Product not found');e.status=404;throw e;}
  const attributes=(await c.query('SELECT a.*,k.code AS kind_code,k.name AS kind_name,k.entry_profile,k.fixed_source_mode,k.is_active AS kind_active FROM product_attributes a JOIN product_kinds k ON k.id=a.product_kind_id WHERE a.product_id=$1',[id])).rows[0];
  if(!attributes||attributes.kind_code!==p.product_kind){const e=new Error('Matching tag-model product attributes are required');e.status=409;throw e;}
  const tags=(await c.query('SELECT t.id,t.code,t.name,t.is_active,t.tag_group_id,g.code AS group_code,g.name AS group_name,g.is_active AS group_active FROM product_tags pt JOIN tags t ON t.id=pt.tag_id JOIN tag_groups g ON g.id=t.tag_group_id WHERE pt.product_id=$1 ORDER BY g.sort_order,g.id,t.sort_order,t.id',[id])).rows;
  const categories=(await c.query('SELECT category_id,is_primary FROM product_categories WHERE product_id=$1 ORDER BY category_id',[id])).rows;
  return {...p,tag_model:true,attributes,tags,tag_ids:tags.map(t=>t.id),specs:{},category_ids:categories.map(x=>x.category_id),primary_category_id:categories.find(x=>x.is_primary)?.category_id||null};
 }
 async function writeProduct(){const e=new Error('Legacy product writes are retired. Use the revision-aware taxonomy/products-v2 API.');e.status=410;throw e;}
 return {audit,detail,writeProduct};
}
module.exports={createProductService};
