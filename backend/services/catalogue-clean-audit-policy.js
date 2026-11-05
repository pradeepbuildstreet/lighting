"use strict";
function assertCleanAudit({audit,product,recordCount,candidateCount}){
 const fail=message=>{throw Object.assign(new Error(message),{status:409});};
 if(!audit||!product||audit.product_id!==product.id||audit.status!=='completed'||audit.algorithm_version!=='tags-evidence-v2'||!audit.corpus_digest||String(audit.product_revision)!==String(product.revision))fail('Automatic distinct approval requires a completed current tags-evidence-v2 audit');
 if(product.review_status!=='pending_review'||product.duplicate_of_product_id)fail('Current product state requires manual review');
 if(!Number.isSafeInteger(recordCount)||recordCount<1||recordCount>1000||audit.scanned_count===null||audit.scanned_count===undefined||Number(audit.scanned_count)!==recordCount-1)fail('Automatic distinct approval requires a complete catalogue scan');
 if(candidateCount!==0)fail('Potential duplicates require manual review');
}
module.exports={assertCleanAudit};
