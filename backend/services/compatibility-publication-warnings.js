"use strict";
const {compatibilityStateByProducts}=require('./catalogue-compatibility-state');
const unavailable=()=>({status:'unavailable',warnings:['Compatibility status could not be verified. Check the assessment service or migration. This warning does not prevent publication.']});
function classifyCompatibilityStatus(result){
 if(!result||typeof result!=='object')return unavailable();
 if(result.mode==='integrated'||result.status==='not_applicable')return {status:'not_applicable',warnings:[]};
 if(result.status==='not_assessed')return {status:'not_assessed',warnings:['Compatibility assessment required.']};
 if(result.status==='stale')return {status:'stale',warnings:['Compatibility assessment needs updating.']};
 if(result.status!=='current'||!Array.isArray(result.groups))return unavailable();
 if(!result.groups.length)return {status:'current',warnings:['No socket groups configured. No compatible lights available.']};
 const warnings=[];let unknown=false;
 for(const group of result.groups){
  if(!group||typeof group!=='object'){unknown=true;continue;}
  let count;
  if(Number.isInteger(group.eligible_count)&&group.eligible_count>=0)count=group.eligible_count;
  else if(Array.isArray(group.entries)&&group.entries.every(e=>e&&typeof e.eligible==='boolean'))count=group.entries.filter(e=>e.eligible).length;
  else{unknown=true;continue;}
  if(count===0){const code=typeof group.code==='string'&&group.code.trim()?group.code.trim():typeof group.group_code==='string'&&group.group_code.trim()?group.group_code.trim():'unspecified';warnings.push('No compatible lights available for socket group '+code+'.');}
 }
 if(unknown)warnings.push('Compatibility results are incomplete. Check the saved assessment; this warning does not prevent publication.');
 return {status:'current',warnings:[...new Set(warnings)]};
}
async function compatibilityPublicationWarnings(product,db,options={}){
 if(!product)return {status:'not_applicable',warnings:[]};
 return (await compatibilityStateByProducts(db,[product])).get(product.id);
}
module.exports={compatibilityPublicationWarnings,classifyCompatibilityStatus};
