"use strict";
const crypto=require('node:crypto');
const TAG_ALGORITHM='tags-evidence-v2';
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function tagDigest(rows){const snapshot=rows.map(p=>({id:p.id,revision:String(p.revision),is_active:p.is_active,product_kind:p.product_kind,name:p.name,brand:p.brand,model_number:p.model_number,duplicate_of_product_id:p.duplicate_of_product_id||null,review_status:p.review_status,attributes:p.attributes||null,tags:[...(p.tags||[])].sort((a,b)=>a.id.localeCompare(b.id)),image_hashes:[...new Set(p.image_hashes||[])].sort()})).sort((a,b)=>a.id.localeCompare(b.id));return crypto.createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex');}
function assertAlgorithm(audit,tagModel){if((tagModel&&audit.algorithm_version!==TAG_ALGORITHM)||(!tagModel&&audit.algorithm_version===TAG_ALGORITHM)){const e=new Error('Audit algorithm does not match the product model; rerun the audit');e.status=409;throw e;}}
module.exports={TAG_ALGORITHM,tagDigest,assertAlgorithm};
