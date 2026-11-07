"use strict";
const crypto=require('node:crypto');
const ALGORITHM='tags-evidence-v2',FORMAT='tags-evidence-corpus-v3';
const retained=d=>d==='approve_distinct'||d==='retain_primary';
const reviewable=p=>p&&['draft','pending_audit','pending_review','approved'].includes(p.review_status)&&!p.duplicate_of_product_id;
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
function fingerprint(p){
 if(!p||!p.id||!p.attributes||!Array.isArray(p.tags)||!Array.isArray(p.image_hashes))return null;
 const attributes=Object.fromEntries(Object.entries(p.attributes).filter(([k])=>!['updated_at','created_at'].includes(k)));
 const tags=p.tags.map(t=>({id:t.id,tag_group_id:t.tag_group_id,is_active:t.is_active!==false,group_active:t.group_active!==false})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const data={id:p.id,revision:String(p.revision),product_kind:p.product_kind,name:p.name??null,brand:p.brand??null,model_number:p.model_number??null,kind:p.kind??null,attributes,tags,image_hashes:[...new Set(p.image_hashes.filter(h=>typeof h==='string').map(h=>h.toLowerCase()))].sort()};
 return crypto.createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
}
function createResolvedPairs(records,rows,heads){
 const live=new Map(records.map(p=>[p.id,p])),latest=new Map(heads.map(h=>[h.product_id,h])),members=new Map();
 for(const row of rows){const p=live.get(row.product_id),head=latest.get(row.product_id),snapshot=row.product_snapshot;
  if(row.algorithm_version!==ALGORITHM||row.evidence_format!==FORMAT||!retained(row.decision)||!reviewable(p)||!head||!retained(head.decision)||head.status!=='completed'||head.algorithm_version!==ALGORITHM||String(head.product_revision)!==String(p.revision)||String(row.reviewed_revision)!==String(p.revision)||snapshot?.id!==p.id||String(snapshot.revision)!==String(p.revision))continue;
  const stamp=fingerprint(snapshot);if(!stamp||stamp!==fingerprint(p))continue;
  if(!members.has(p.id))members.set(p.id,new Map());members.get(p.id).set(row.group_id,{row,stamp});
 }
 return {get(a,b){if(!reviewable(a)||!reviewable(b)||a.id===b.id)return null;const left=members.get(a.id),right=members.get(b.id);if(!left||!right)return null;
  for(const [group,x] of left){const y=right.get(group);if(!y||fingerprint(a)!==x.stamp||fingerprint(b)!==y.stamp)continue;return {product_id:a.id,candidate_product_id:b.id,group_resolution_id:group,reviewer_id:x.row.reviewer_id,reviewed_at:x.row.created_at,notes_excerpt:typeof x.row.notes==='string'?x.row.notes.slice(0,400):'',subject_revision:String(a.revision),candidate_revision:String(b.revision),decision:'previously_reviewed_distinct'};}
  return null;
 }};
}
async function loadResolvedPairs(c,records){
 const empty=()=>createResolvedPairs(records,[],[]);
 const installed=(await c.query("SELECT to_regclass('public.product_duplicate_groups') IS NOT NULL AND to_regclass('public.product_duplicate_group_items') IS NOT NULL AS installed")).rows[0]?.installed;
 if(installed!==true)return empty();
 const ids=records.map(p=>p.id);
 const rows=(await c.query(`SELECT i.product_id,i.group_id,i.reviewed_revision,i.decision,i.product_snapshot,g.reviewer_id,g.created_at,g.notes,g.algorithm_version,g.evidence_snapshot->>'format' AS evidence_format
  FROM public.product_duplicate_group_items i JOIN public.product_duplicate_groups g ON g.id=i.group_id
  JOIN public.products p ON p.id=i.product_id AND p.revision=i.reviewed_revision
  JOIN public.product_duplicate_audits a ON a.id=i.audit_id AND a.product_id=i.product_id AND a.product_revision=i.reviewed_revision AND a.status='completed' AND a.algorithm_version=g.algorithm_version AND a.corpus_digest=g.corpus_digest
  JOIN public.product_duplicate_reviews r ON r.id=i.review_id AND r.audit_id=a.id AND r.group_resolution_id=g.id AND r.reviewer_id=g.reviewer_id AND r.decision=i.decision AND r.duplicate_of_product_id IS NOT DISTINCT FROM i.duplicate_of_product_id
  WHERE i.product_id=ANY($1::uuid[]) AND i.decision IN ('approve_distinct','retain_primary') AND g.algorithm_version=$2
  ORDER BY g.created_at DESC,g.id DESC,i.product_id`,[ids,ALGORITHM])).rows;
 if(!rows.length)return empty();
 const heads=(await c.query(`SELECT p.id AS product_id,h.decision,h.product_revision,h.algorithm_version,h.status
  FROM public.products p LEFT JOIN LATERAL(SELECT r.decision,a.product_revision,a.algorithm_version,a.status FROM public.product_duplicate_audits a JOIN public.product_duplicate_reviews r ON r.audit_id=a.id WHERE a.product_id=p.id ORDER BY a.created_at DESC,a.id DESC,r.created_at DESC,r.id DESC LIMIT 1)h ON true WHERE p.id=ANY($1::uuid[])`,[ids])).rows;
 return createResolvedPairs(records,rows,heads);
}
function partitionComparisons(records,members,compare,book,eligible=p=>p.review_status!=='duplicate'&&!p.duplicate_of_product_id){
 const selected=new Set(members.map(p=>p.id)),outside=new Set(),comparisons=[],resolved_comparisons=[],seen=new Set();
 for(const subject of members)for(const candidate of records){if(subject.id===candidate.id||!eligible(candidate))continue;const result=compare(subject,candidate);if(!result||result.overall_score<35)continue;
  const proof=book.get(subject,candidate);if(proof){const key=[subject.id,candidate.id].sort().join(':');if(!seen.has(key)){seen.add(key);resolved_comparisons.push(proof);}continue;}
  comparisons.push({...result,product_id:subject.id,candidate_product_id:candidate.id});if(!selected.has(candidate.id))outside.add(candidate.id);
 }
 return {comparisons,outside_product_ids:[...outside].sort(),resolved_comparisons};
}
module.exports={fingerprint,createResolvedPairs,loadResolvedPairs,partitionComparisons};
