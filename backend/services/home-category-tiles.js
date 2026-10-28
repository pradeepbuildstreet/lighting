"use strict";
const {mediaDTO}=require('./public-catalogue-v1');
const SQL=`WITH RECURSIVE active_tree AS (
 SELECT id,parent_id,slug,name,sort_order,ARRAY[id] AS ids,ARRAY[slug] AS slugs
 FROM categories WHERE is_active AND parent_id IS NULL
 UNION ALL
 SELECT c.id,c.parent_id,c.slug,c.name,c.sort_order,t.ids||c.id,t.slugs||c.slug
 FROM categories c JOIN active_tree t ON c.parent_id=t.id
 WHERE c.is_active AND NOT c.id=ANY(t.ids)
),direct_products AS (
 SELECT DISTINCT pc.category_id,p.id,p.name,p.created_at
 FROM product_categories pc JOIN active_tree ct ON ct.id=pc.category_id
 JOIN public_products p ON p.id=pc.product_id
 WHERE EXISTS(SELECT 1 FROM product_categories primary_pc
 JOIN active_tree primary_ct ON primary_ct.id=primary_pc.category_id
 WHERE primary_pc.product_id=p.id AND primary_pc.is_primary)
),counts AS (
 SELECT category_id,count(*)::integer AS product_count FROM direct_products GROUP BY category_id
)
SELECT ct.id,ct.name,ct.slugs,n.product_count,cover.media,cover.product_name
FROM active_tree ct JOIN counts n ON n.category_id=ct.id
LEFT JOIN LATERAL (
 SELECT row_to_json(m) AS media,p.name AS product_name
 FROM direct_products p JOIN product_media m ON m.product_id=p.id
 WHERE p.category_id=ct.id AND m.media_type='image'
 AND m.processing_status IN ('completed','not_applicable')
 ORDER BY m.is_primary DESC,p.created_at DESC,p.id,m.sort_order,m.id LIMIT 1
) cover ON true
ORDER BY ct.sort_order,ct.name,ct.id`;
function createService(db){
 async function tiles(){return db.transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL statement_timeout='5s'");
  const rows=(await c.query(SQL)).rows;
  return {source:'catalogue',categories:rows.map(row=>{
   const image=row.media?mediaDTO(row.media):null;
   return {id:row.id,name:row.name,path:row.slugs.join('/'),product_count:Number(row.product_count),image:image?{url:image.url,alt:image.alt||row.product_name||row.name}:null};
  })};
 });}
 return {tiles};
}
module.exports={createService,SQL};
