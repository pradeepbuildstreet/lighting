"use strict";
const {classifyCompatibilityStatus}=require('./compatibility-publication-warnings');
function unavailable(){return classifyCompatibilityStatus(null);}
async function compatibilityWarningsByProducts(db,products,options={}){
 if(!Array.isArray(products)||products.length>200)throw Error('At most 200 products per warnings batch');
 const result=new Map(products.map(p=>[p.id,{status:'not_applicable',warnings:[]}]));
 const fixtures=products.filter(p=>p.product_kind==='fixture');if(!fixtures.length)return result;
 try{
  await db.transaction(async client=>{
   await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await client.query("SET LOCAL statement_timeout='15s'");
   const cache=new Map();
   const proxy={query:async(sql,params)=>{
    const normalized=sql.replace(/\s+/g,' ').trim();
    // status() opens a read-only transaction itself. Here all statuses share one identical read-only snapshot.
    if(normalized==='SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'||normalized==="SET LOCAL statement_timeout='15s'")return {rows:[]};
    const shared=(!params||params.length===0)&&/^WITH RECURSIVE active_tree AS/i.test(normalized)&&/FROM public_products p JOIN light_specs/i.test(normalized);
    if(shared){if(!cache.has(sql))cache.set(sql,client.query(sql,params));return cache.get(sql);}
    return client.query(sql,params);
   }};
   const bridge={transaction:async fn=>fn(proxy)};
   const service=options.createService?options.createService({db:bridge}):require('./compatibility-assessments').createService({db:bridge});
   for(const p of fixtures){try{result.set(p.id,classifyCompatibilityStatus(await service.status(p.id)));}catch(error){if(typeof error?.code==='string')throw error;result.set(p.id,unavailable());}}
  });
 }catch(error){for(const p of fixtures)result.set(p.id,unavailable());if(options.log!==false)console.warn(JSON.stringify({event:'compatibility_list_warning_unavailable',code:typeof error?.code==='string'?error.code:'STATUS_UNAVAILABLE'}));}
 return result;
}
async function attachCompatibilityVisibilityWarnings(db,products,visibility,options){
 const warnings=await compatibilityWarningsByProducts(db,products,options);
 for(const p of products){const current=visibility.get(p.id);if(!current)continue;const value=warnings.get(p.id)||unavailable();visibility.set(p.id,{...current,compatibility_warnings:value.warnings,compatibility_validation:{status:value.status}});}
 return visibility;
}
module.exports={compatibilityWarningsByProducts,attachCompatibilityVisibilityWarnings};
