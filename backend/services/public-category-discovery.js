"use strict";
const {uuid}=require('./public-catalogue-v1');
const {COUNTS}=require('./homepage-collections');
const {TREE}=require('./public-catalogue-tag-filters');
const ELIGIBLE=`EXISTS(SELECT 1 FROM product_categories primary_pc JOIN active_tree primary_ct ON primary_ct.id=primary_pc.category_id WHERE primary_pc.product_id=p.id AND primary_pc.is_primary)`;
const CANDIDATES=TREE+`,eligible AS (
 SELECT p.id,p.created_at FROM public_products p
 WHERE ${ELIGIBLE} AND p.id<>$1::uuid
 AND EXISTS(SELECT 1 FROM product_categories pc JOIN active_tree ct ON ct.id=pc.category_id WHERE pc.product_id=p.id AND ct.id=$2::uuid)
),enquiry_counts AS (
 ${COUNTS} AND i.product_id IN (SELECT id FROM eligible) GROUP BY i.product_id
)`;
function createService({db,publicCatalogue}){
 async function discover(value){
  const current=uuid(value),detail=await publicCatalogue.detail(current,true),category=detail.product.categories.find(c=>c.primary);
  if(!category)return {source:'catalogue',product_id:current,category:null,most_enquired:[],latest:[]};
  const ids=await db.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await c.query("SET LOCAL statement_timeout='5s'");
   const popular=(await c.query(CANDIDATES+` SELECT e.id,n.enquiry_count FROM eligible e JOIN enquiry_counts n ON n.product_id=e.id WHERE n.enquiry_count>0 ORDER BY n.enquiry_count DESC,e.id ASC LIMIT 6`,[current,category.id])).rows;
   const latest=(await c.query(CANDIDATES+` SELECT e.id FROM eligible e WHERE NOT (e.id=ANY($3::uuid[])) ORDER BY e.created_at DESC,e.id ASC LIMIT 6`,[current,category.id,popular.map(p=>p.id)])).rows;
   return {popular,latest};
  });
  const requested=[...ids.popular,...ids.latest].map(p=>p.id);
  const visible=requested.length?(await publicCatalogue.byIds(requested)).products:[];
  const map=new Map(visible.map(p=>[p.id,p]));
  return {source:'catalogue',product_id:current,category:{id:category.id,name:category.name,path:category.path},
   most_enquired:ids.popular.filter(p=>map.has(p.id)).map(p=>({...map.get(p.id),enquiry_count:Number(p.enquiry_count)})),
   latest:ids.latest.filter(p=>map.has(p.id)).map(p=>map.get(p.id))};
 }
 return {discover};
}
module.exports={createService,CANDIDATES};
