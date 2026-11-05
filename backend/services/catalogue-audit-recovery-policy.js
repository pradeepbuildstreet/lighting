"use strict";
const FRESHNESS_ERROR='Catalogue evidence changed; rerun the audit';
function canResumeFreshAudit(row,now=Date.now()){
 if(row.status!=='held'||row.last_error!==FRESHNESS_ERROR)return false;
 if(!row.actor_id||row.actor_role!=='admin'||![true,'true'].includes(row.actor_active))return false;
 if(row.live_review_status!=='pending_review'||row.live_duplicate_of_product_id)return false;
 if(!String(row.live_sku||'').trim()||!String(row.live_name||'').trim())return false;
 if(!/^[1-9]\d*$/.test(String(row.product_revision))||String(row.product_revision)!==String(row.live_revision)||String(row.audited_revision)!==String(row.live_revision))return false;
 if(!row.latest_audit_id||row.audit_status!=='completed'||row.algorithm_version!=='tags-evidence-v2'||row.has_corpus_digest!==true||row.has_review!==false)return false;
 const completed=new Date(row.audit_completed_at).getTime(),held=new Date(row.updated_at).getTime();
 if(!Number.isFinite(completed)||!Number.isFinite(held)||completed<=held)return false;
 if(row.lease_until){const lease=new Date(row.lease_until).getTime();if(!Number.isFinite(lease)||lease>now)return false;}
 const count=Number(row.catalogue_count),scanned=Number(row.scanned_count),candidates=Number(row.candidate_count);
 if(row.scanned_count==null||row.candidate_count==null||!Number.isSafeInteger(count)||count<1||count>1000||!Number.isSafeInteger(scanned)||scanned!==count-1||!Number.isSafeInteger(candidates)||candidates<0)return false;
 return true;
}
module.exports={FRESHNESS_ERROR,canResumeFreshAudit};
