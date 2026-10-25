"use strict";
const {compatibilityStateByProducts}=require('./catalogue-compatibility-state');
async function compatibilityWarningsByProducts(db,products,options={}){return compatibilityStateByProducts(db,products);}
async function attachCompatibilityVisibilityWarnings(db,products,visibility,options){
 const warnings=await compatibilityWarningsByProducts(db,products,options);
 for(const p of products){const current=visibility.get(p.id);if(!current)continue;const value=warnings.get(p.id);visibility.set(p.id,{...current,compatibility_warnings:value.warnings,compatibility_validation:{status:value.status}});}
 return visibility;
}
module.exports={compatibilityWarningsByProducts,attachCompatibilityVisibilityWarnings};
