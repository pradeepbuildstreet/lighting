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
export function reviewBlockReason(audit,product,reviews=[],busy=false) {
 if(busy)return 'An operation is in progress. Wait for it to finish.';
 if(!product)return 'Load a product before reviewing.';
 if(!String(product.sku||'').trim()||!String(product.name||'').trim())return 'Save a product name and assign its SKU before recording a review.';
 if(!audit)return 'Run a fresh duplicate audit before recording a review.';
 if(audit.status!=='completed')return 'The duplicate audit must complete before review.';
 if(String(audit.product_revision)!==String(product.revision))return 'Product changed since this audit. Run a fresh duplicate audit.';
 if(reviews.length)return 'This audit already has a recorded decision. Inspect that decision; a new decision requires a fresh audit.';
 return '';
}
