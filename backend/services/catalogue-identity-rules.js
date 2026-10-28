"use strict";
const RULE_VERSION=4;
const DEFAULT_RULE=Object.freeze({groups:Object.freeze(['style','finish','material']),maxPerGroup:2,separator:' & ',maxLength:255,includeBrand:true,includePrimaryCategory:true});
const clean=v=>typeof v==='string'?v.trim().replace(/\s+/g,' '):'';
const KIND_LABELS=Object.freeze({fixture:'Fixture','integrated-light':'Integrated Light','replaceable-bulb':'Replaceable Bulb/Lamp'});
function singularKindLabel(kind){if(typeof kind==='string')return KIND_LABELS[kind]||clean(kind);const code=kind?.code,label=clean(kind?.name);return KIND_LABELS[code]||label;}
function suggestName({brand,categoryName,kindName,kindCode,tags=[]},rule=DEFAULT_RULE){
 const parts=[],brandLabel=clean(brand),categoryLabel=clean(categoryName),kindLabel=singularKindLabel(kindCode?{code:kindCode,name:kindName}:kindName);
 if(rule.includeBrand!==false&&brandLabel)parts.push(brandLabel);
 for(const group of rule.groups){const names=[...new Set(tags.filter(t=>t.group_code===group&&t.is_active!==false&&t.group_active!==false).map(t=>clean(t.name)).filter(Boolean))].sort((a,b)=>a<b?-1:a>b?1:0);if(names.length)parts.push(names.slice(0,rule.maxPerGroup).join(rule.separator));}
 if(rule.includePrimaryCategory!==false&&categoryLabel)parts.push(categoryLabel);
 if(kindLabel)parts.push(kindLabel);
 const name=parts.join(' ').replace(/\s+/g,' ').trim();if(name.length>rule.maxLength)throw new Error('Suggested name exceeds '+rule.maxLength+' characters; shorten the brand or selected components');return {name,rule_version:RULE_VERSION};
}
function pendingIdentity(product){return !product?.sku||!String(product?.name||'').trim();}
module.exports={RULE_VERSION,DEFAULT_RULE,KIND_LABELS,singularKindLabel,suggestName,pendingIdentity};
