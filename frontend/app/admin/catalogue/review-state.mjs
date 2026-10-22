export function canReview(audit,product,reviews=[]) {
 return !!audit && !!product && audit.status==='completed' && String(audit.product_revision)===String(product.revision) && reviews.length===0;
}
export function candidateState(candidate) {
 const snapshot=candidate?.evidence?.candidate_revision;
 return snapshot==null || candidate?.current_revision==null ? 'unknown' : String(snapshot)===String(candidate.current_revision)?'current':'changed';
}
export function reviewError(decision,notes,target) {
 if(!['approve_distinct','confirm_duplicate','request_correction','reject'].includes(decision))return 'Choose a review decision';
 if(!notes.trim())return 'Review notes are required';
 if(notes.trim().length>5000)return 'Review notes exceed 5000 characters';
 if(decision==='confirm_duplicate'&&!target)return 'Choose a duplicate target';
 return '';
}
export function publicationAction(state) {
 return state?.product?.published ? 'unpublish' : state?.can_publish ? 'publish' : 'blocked';
}
