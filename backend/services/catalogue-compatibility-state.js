"use strict";
const unavailable=()=>({status:'unavailable',warnings:['Compatibility is unavailable pending the tag-model rebuild. Tags do not certify fixture/light compatibility. This warning does not prevent publication.']});
async function compatibilityStateByProducts(db,products){
 if(!Array.isArray(products)||products.length>200)throw Error('At most 200 products per warnings batch');
 const result=new Map(products.map(p=>[p.id,unavailable()]));
 if(!products.length)return result;
 try{
  const rows=(await db.query('SELECT a.product_id,k.entry_profile,a.light_source_mode FROM product_attributes a JOIN product_kinds k ON k.id=a.product_kind_id JOIN products p ON p.id=a.product_id AND p.product_kind=k.code WHERE a.product_id=ANY($1::uuid[])',[products.map(p=>p.id)])).rows;
  for(const row of rows){if(!result.has(row.product_id))continue;if(['general','light_source'].includes(row.entry_profile)||row.entry_profile==='fixture'&&row.light_source_mode==='integrated')result.set(row.product_id,{status:'not_applicable',warnings:[]});}
 }catch(_){/* Unverified is never a compatibility certification. */}
 return result;
}
module.exports={compatibilityStateByProducts};
