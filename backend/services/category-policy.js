"use strict";
function fail(message){const error=new Error(message);error.status=400;throw error;}
function directProducts(value,fallback=true){if(value===undefined)return fallback;if(typeof value!=='boolean')fail('Allow products directly must be true or false');return value;}
function checkCategoryRows(ids,rows){
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)fail('Category assignments must be unique');
 const byId=new Map(rows.map(row=>[row.id,row]));
 for(const id of ids){const row=byId.get(id);if(!row||row.is_active!==true)fail('All assigned categories must be active');if(row.allow_direct_products!==true)fail('Products cannot be assigned directly to '+(row.name||row.slug||id)+'. Select an assignable subcategory.');}
}
async function validateAssignments(client,ids){
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)fail('Category assignments must be unique');
 await client.query('SELECT pg_advisory_xact_lock(8102401)');
 if(!ids.length)return;
 const result=await client.query('SELECT id,name,slug,is_active,allow_direct_products FROM categories WHERE id=ANY($1::uuid[])',[ids]);
 checkCategoryRows(ids,result.rows);
}
async function validateDirectSetting(client,id,allow){
 if(allow)return;
 const result=await client.query('SELECT p.sku FROM product_categories pc JOIN products p ON p.id=pc.product_id WHERE pc.category_id=$1 ORDER BY p.sku LIMIT 6',[id]);
 if(result.rows.length){const names=result.rows.slice(0,5).map(row=>row.sku).join(', ');fail('Move directly assigned products before disabling direct products: '+names+(result.rows.length>5?', ...':''));}
}
module.exports={directProducts,checkCategoryRows,validateAssignments,validateDirectSetting};
