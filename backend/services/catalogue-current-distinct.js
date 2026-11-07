"use strict";
const {fingerprint}=require('./catalogue-resolved-pairs');
function createCurrentDistinct(records,proofs){
 const live=new Map(records.map(p=>[p.id,p])),valid=new Map();
 for(const row of proofs){const p=live.get(row.product_id);if(!p||p.review_status!=='approved'||p.duplicate_of_product_id||String(p.approved_revision)!==String(p.revision)||p.approved_by!==row.reviewer_id||row.approval_valid!==true||row.decision!=='approve_distinct'||row.status!=='completed'||row.algorithm_version!=='tags-evidence-v2'||String(row.product_revision)!==String(p.revision))continue;const stamp=fingerprint(p);if(!stamp)continue;valid.set(p.id,{stamp,row});}
 function current(p){const entry=valid.get(p?.id);if(!entry||p.review_status!=='approved'||p.duplicate_of_product_id||String(p.approved_revision)!==String(p.revision)||p.approved_by!==entry.row.reviewer_id||fingerprint(p)!==entry.stamp)return null;const r=entry.row;return {product_id:p.id,reviewed_revision:String(p.revision),decision:'approve_distinct',audit_id:r.audit_id,review_id:r.review_id,group_resolution_id:r.group_resolution_id??null,reviewer_id:r.reviewer_id,reviewed_at:r.created_at,notes_excerpt:r.notes_excerpt||'',source:'current_valid_distinct_approval'};}
 return {current,get(a,b){if(a.id===b.id)return null;const x=current(a),y=current(b);if(!x||!y)return null;return {product_id:a.id,candidate_product_id:b.id,decision:'previously_reviewed_distinct',source:'current_distinct_approvals',subject_revision:x.reviewed_revision,candidate_revision:y.reviewed_revision,subject_review_id:x.review_id,candidate_review_id:y.review_id,subject_approval:x,candidate_approval:y};}};
}
async function loadCurrentDistinct(c,records){
 const proofs=(await c.query(`SELECT p.id AS product_id,a.id AS audit_id,a.product_revision,a.status,a.algorithm_version,r.id AS review_id,r.decision,r.group_resolution_id,r.reviewer_id,r.created_at,left(r.notes,400) AS notes_excerpt,
  public.current_duplicate_approval(p.id,p.revision,p.approved_by,p.product_kind) AS approval_valid
  FROM public.products p LEFT JOIN LATERAL(SELECT * FROM public.product_duplicate_audits WHERE product_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1)a ON true
  LEFT JOIN LATERAL(SELECT * FROM public.product_duplicate_reviews WHERE audit_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1)r ON true
  WHERE p.id=ANY($1::uuid[]) AND p.review_status='approved' AND p.duplicate_of_product_id IS NULL AND r.decision='approve_distinct'`,[records.map(p=>p.id)])).rows;
 return createCurrentDistinct(records,proofs);
}
module.exports={createCurrentDistinct,loadCurrentDistinct};
