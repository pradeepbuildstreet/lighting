"use strict";
async function analytics(query){const result=await query(`WITH events AS (
 SELECT i.*,w.submitted_at,'catalogue:'||i.product_id::text AS identity_key FROM wishlist_items i JOIN wishlists w ON w.id=i.wishlist_id
 ),totals AS (SELECT identity_key,COUNT(DISTINCT wishlist_id)::integer AS wishlist_count,COUNT(DISTINCT wishlist_id) FILTER(WHERE submitted_at IS NOT NULL)::integer AS submitted_enquiries,MAX(updated_at) AS last_wishlisted_at FROM events GROUP BY identity_key),latest AS (
 SELECT DISTINCT ON(identity_key) identity_key,product_id,sku,name,price,currency,image_url,media,product_href FROM events ORDER BY identity_key,updated_at DESC,id DESC
 ) SELECT latest.*,totals.wishlist_count,totals.submitted_enquiries,totals.last_wishlisted_at,totals.wishlist_count AS wishlist_sessions FROM latest JOIN totals USING(identity_key) ORDER BY totals.wishlist_count DESC,totals.submitted_enquiries DESC,latest.name,latest.identity_key`);return result.rows;}
module.exports={analytics};
