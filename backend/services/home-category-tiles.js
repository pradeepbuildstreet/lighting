"use strict";
const {uuid}=require('./public-catalogue-v1');
const {sendImage}=require('./category-images');
const TREE=`WITH RECURSIVE active_tree AS (
 SELECT id,parent_id,slug,name,sort_order,ARRAY[id] AS ids,ARRAY[slug] AS slugs FROM categories WHERE is_active AND parent_id IS NULL
 UNION ALL SELECT c.id,c.parent_id,c.slug,c.name,c.sort_order,t.ids||c.id,t.slugs||c.slug FROM categories c JOIN active_tree t ON c.parent_id=t.id WHERE c.is_active AND NOT c.id=ANY(t.ids)
),direct_products AS (
 SELECT DISTINCT pc.category_id,p.id FROM product_categories pc JOIN active_tree ct ON ct.id=pc.category_id JOIN public_products p ON p.id=pc.product_id
 WHERE EXISTS(SELECT 1 FROM product_categories primary_pc JOIN active_tree primary_ct ON primary_ct.id=primary_pc.category_id WHERE primary_pc.product_id=p.id AND primary_pc.is_primary)
)`;
const SQL=TREE+`,counts AS (SELECT category_id,count(*)::integer AS product_count FROM direct_products GROUP BY category_id)
 SELECT ct.id,ct.name,ct.slugs,n.product_count,ci.revision FROM active_tree ct JOIN counts n ON n.category_id=ct.id LEFT JOIN category_images ci ON ci.category_id=ct.id ORDER BY ct.sort_order,ct.name,ct.id`;
function createService(db){
 async function tiles(){return db.transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='5s'");
  const rows=(await c.query(SQL)).rows;
  return {source:'catalogue',categories:rows.map(row=>({id:row.id,name:row.name,path:row.slugs.join('/'),product_count:Number(row.product_count),image:row.revision?{url:'/api/catalogue/category-images/'+row.id+'/'+row.revision,alt:row.name}:null}))};
 });}
 async function image(id,revision,res){id=uuid(id);revision=uuid(revision);const row=(await db.query(TREE+' SELECT ci.content_type,ci.image_data FROM category_images ci JOIN active_tree ct ON ct.id=ci.category_id WHERE ci.category_id=$1 AND ci.revision=$2 AND EXISTS(SELECT 1 FROM direct_products p WHERE p.category_id=ct.id)',[id,revision])).rows[0];if(!row)throw Object.assign(new Error('Not found'),{status:404});return sendImage(res,row);}
 return {tiles,image};
}
module.exports={createService,SQL};
