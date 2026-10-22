"use strict";
const COUNT_KEYS=['active_admins','active_admins_with_password','wishlist_items','unmapped_wishlist_items','offer_items','unmapped_offer_items','missing_wishlist_products','missing_offer_products','legacy_wishlist_images','legacy_offer_images'];
const SQL=`SELECT
 (SELECT count(*) FROM public.app_users WHERE role='admin' AND is_active) AS active_admins,
 (SELECT count(*) FROM public.app_users WHERE role='admin' AND is_active AND length(password_hash)=60 AND left(password_hash,4) IN ('$2a$','$2b$','$2y$')) AS active_admins_with_password,
 (SELECT count(*) FROM public.wishlist_items) AS wishlist_items,
 (SELECT count(*) FROM public.wishlist_items WHERE product_id IS NULL) AS unmapped_wishlist_items,
 (SELECT count(*) FROM public.wishlist_offer_items) AS offer_items,
 (SELECT count(*) FROM public.wishlist_offer_items WHERE product_id IS NULL) AS unmapped_offer_items,
 (SELECT count(*) FROM public.wishlist_items i WHERE i.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.products p WHERE p.id=i.product_id)) AS missing_wishlist_products,
 (SELECT count(*) FROM public.wishlist_offer_items i WHERE i.product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.products p WHERE p.id=i.product_id)) AS missing_offer_products,
 (SELECT count(*) FROM public.wishlist_items WHERE lower(coalesce(image_url,'')) LIKE 'uploads/%' OR position('/uploads/' in lower(coalesce(image_url,'')))>0 OR position('/uploads/' in lower(coalesce(media::text,'')))>0) AS legacy_wishlist_images,
 (SELECT count(*) FROM public.wishlist_offer_items WHERE lower(coalesce(image_url,'')) LIKE 'uploads/%' OR position('/uploads/' in lower(coalesce(image_url,'')))>0 OR position('/uploads/' in lower(coalesce(media::text,'')))>0) AS legacy_offer_images`;
function interpretFacts(row){
 const counts={};for(const key of COUNT_KEYS){const raw=row?.[key];if(typeof raw!=='number'&&!(typeof raw==='string'&&/^\d+$/.test(raw)))throw new Error('Invalid preflight result');const n=Number(raw);if(!Number.isSafeInteger(n)||n<0)throw new Error('Invalid preflight count');counts[key]=n;}
 for(const [part,total] of [['active_admins_with_password','active_admins'],['unmapped_wishlist_items','wishlist_items'],['unmapped_offer_items','offer_items'],['missing_wishlist_products','wishlist_items'],['missing_offer_products','offer_items'],['legacy_wishlist_images','wishlist_items'],['legacy_offer_images','offer_items']])if(counts[part]>counts[total])throw new Error('Inconsistent preflight counts');
 const blockers=[],warnings=[];
 if(!counts.active_admins_with_password)blockers.push('No active admin with a plausible bcrypt password hash. Verify existing sign-in; do not recreate accounts automatically.');
 if(counts.unmapped_wishlist_items)blockers.push('Wishlist/enquiry items lack catalogue UUIDs. Resolve before removing SKU fallbacks.');
 if(counts.unmapped_offer_items)blockers.push('Saved offer items lack catalogue UUIDs. Preserve agreed values; no automatic historical rewriting.');
 if(counts.missing_wishlist_products)warnings.push('Saved wishlist UUIDs reference missing catalogue products; review lifecycle.');
 if(counts.missing_offer_products)warnings.push('Saved offer UUIDs reference missing products; historical snapshots may be intentional.');
 if(counts.legacy_wishlist_images||counts.legacy_offer_images)warnings.push('Legacy upload paths detected. Keep media compatibility until references are reviewed.');
 return {status:blockers.length?'blocked_for_fallback_retirement':'ready_for_review',counts,can_remove_sku_fallbacks:blockers.length===0,blockers,warnings,
 limitations:['Hash shape does not prove login.','Upload-path scan does not detect every legacy origin.','This release retains historical fallbacks; a clean report does not delete data.']};
}
async function inspectRetirement(db){return db.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='10s'");const identity=(await c.query('SELECT current_database() AS database_name')).rows[0];const row=(await c.query(SQL)).rows[0];return {...interpretFacts(row),database_name:identity?.database_name||null};});}
module.exports={COUNT_KEYS,SQL,interpretFacts,inspectRetirement};
