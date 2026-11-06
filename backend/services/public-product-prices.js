"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function readPrices(db,raw){
 if(typeof raw!=='string'||raw.length>3700){const e=new Error('Supply 1 to 100 product UUIDs');e.status=400;throw e;}
 const ids=[...new Set(raw.split(',').map(id=>id.toLowerCase()))];
 if(!ids.length||ids.length>100||ids.some(id=>!UUID.test(id))){const e=new Error('Supply 1 to 100 product UUIDs');e.status=400;throw e;}
 const result=await db.query(`WITH RECURSIVE active_tree AS (
 SELECT id,ARRAY[id] AS ids FROM categories WHERE is_active AND parent_id IS NULL
 UNION ALL SELECT c.id,t.ids||c.id FROM categories c JOIN active_tree t ON c.parent_id=t.id WHERE c.is_active AND NOT c.id=ANY(t.ids)
 ) SELECT p.id,p.currency,p.selling_price::text AS list_price,source.default_discount_percent::text AS default_discount_percent,
 round(p.selling_price*(1-source.default_discount_percent/100),2)::text AS discounted_price
 FROM public_products p JOIN products source ON source.id=p.id
 WHERE p.id=ANY($1::uuid[]) AND EXISTS(SELECT 1 FROM product_categories pc JOIN active_tree t ON t.id=pc.category_id WHERE pc.product_id=p.id AND pc.is_primary)`,[ids]);
 return {prices:result.rows};
}
module.exports={readPrices};
