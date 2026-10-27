"use strict";
const RULE_VERSION=1;
const DEFAULT_RULE=Object.freeze({groups:['style','finish','material'],maxPerGroup:2,separator:' & ',maxLength:255});
function suggestName({brand,kindName,tags=[]},rule=DEFAULT_RULE){
 if(typeof kindName!=='string'||!kindName.trim())throw new Error('Product kind label required');
 const parts=[];if(typeof brand==='string'&&brand.trim())parts.push(brand.trim());
 for(const group of rule.groups){const names=[...new Set(tags.filter(t=>t.group_code===group&&t.is_active!==false&&t.group_active!==false).map(t=>String(t.name||'').trim()).filter(Boolean))].sort((a,b)=>a<b?-1:a>b?1:0);if(names.length)parts.push(names.slice(0,rule.maxPerGroup).join(rule.separator));}
 parts.push(kindName.trim());const name=parts.join(' ').replace(/\s+/g,' ').trim();
 if(name.length>rule.maxLength)throw new Error('Suggested name exceeds '+rule.maxLength+' characters; shorten the brand or selected components');
 return {name,rule_version:RULE_VERSION};
}
function pendingIdentity(product){return !product?.sku||!String(product?.name||'').trim();}
module.exports={RULE_VERSION,DEFAULT_RULE,suggestName,pendingIdentity};
