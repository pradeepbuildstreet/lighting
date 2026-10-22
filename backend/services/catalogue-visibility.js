"use strict";
const checks = [
 ['active_ok', 'Product is inactive.'],
 ['published_ok', 'Publication is not enabled.'],
 ['review_ok', 'Product review must be approved.'],
 ['revision_ok', 'Approval does not match the current product revision.'],
 ['not_duplicate_ok', 'Product is marked as a duplicate.'],
 ['price_ok', 'A valid non-negative selling price is required.'],
 ['duplicate_approval_ok', 'Duplicate approval is not valid for the current product revision. Complete duplicate review and approval.'],
 ['primary_category_ok', 'An active primary category is required.'],
 ['primary_image_ok', 'A primary image is required.'],
 ['product_type_spec_ok', 'Specifications must reference an active fixture/light type.'],
 ['category_tree_ok', 'The primary category must belong to an active category hierarchy.']
];
function statusFromRow(row) {
 const reasons = checks.filter(([key]) => row[key] !== true).map(([,message]) => message);
 const visible = row.in_public_view === true && row.category_tree_ok === true;
 if (!visible && reasons.length === 0) reasons.push('The database public-product view excludes this product. Inspect its installed rules.');
 return {published: row.published_ok === true, visible, status: visible ? 'visible' : 'not_visible',
  duplicate_approval_ok: row.duplicate_approval_ok === true, reasons: visible ? [] : reasons};
}
const SQL = `WITH RECURSIVE active_tree AS (
 SELECT id,parent_id,ARRAY[id] AS ids FROM public.categories WHERE is_active AND parent_id IS NULL
 UNION ALL
 SELECT c.id,c.parent_id,t.ids||c.id FROM public.categories c JOIN active_tree t ON c.parent_id=t.id
 WHERE c.is_active AND NOT c.id=ANY(t.ids)
)
SELECT p.id,
 p.is_active AS active_ok, p.published AS published_ok,
 (p.review_status='approved') AS review_ok, (p.approved_revision=p.revision) AS revision_ok,
 (p.duplicate_of_product_id IS NULL) AS not_duplicate_ok,
 (p.selling_price IS NOT NULL AND p.selling_price>=0) AS price_ok,
 public.current_duplicate_approval(p.id,p.revision,p.approved_by,p.product_kind) AS duplicate_approval_ok,
 EXISTS(SELECT 1 FROM public.product_categories pc JOIN public.categories c ON c.id=pc.category_id
  WHERE pc.product_id=p.id AND pc.is_primary AND c.is_active) AS primary_category_ok,
 EXISTS(SELECT 1 FROM public.product_media m WHERE m.product_id=p.id AND m.is_primary AND m.media_type='image') AS primary_image_ok,
 ((p.product_kind='fixture' AND EXISTS(SELECT 1 FROM public.fixture_specs s JOIN public.fixture_types t ON t.id=s.fixture_type_id WHERE s.product_id=p.id AND t.is_active))
  OR (p.product_kind='light' AND EXISTS(SELECT 1 FROM public.light_specs s JOIN public.light_types t ON t.id=s.light_type_id WHERE s.product_id=p.id AND t.is_active))) AS product_type_spec_ok,
 EXISTS(SELECT 1 FROM public.product_categories pc JOIN active_tree ct ON ct.id=pc.category_id WHERE pc.product_id=p.id AND pc.is_primary) AS category_tree_ok,
 EXISTS(SELECT 1 FROM public.public_products pp WHERE pp.id=p.id) AS in_public_view
FROM public.products p WHERE p.id=ANY($1::uuid[])`;
async function visibilityByIds(db, ids) {
 if (!ids.length) return new Map();
 const {rows} = await db.query(SQL, [ids]);
 return new Map(rows.map(row => [row.id, statusFromRow(row)]));
}
module.exports = {visibilityByIds, statusFromRow};
