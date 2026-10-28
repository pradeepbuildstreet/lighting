# Available-data category name components

Name engine version 2 composes available brand, configured ordered tag-group labels, primary category/subcategory label, then product-kind label. All components are trimmed; missing values produce no placeholder, dangling separator or leading/trailing whitespace. Existing JSON remains accepted: includePrimaryCategory defaults true and can be set false explicitly. includeBrand still defaults true but never inserts a fallback brand. Existing saved names and lifetime SKUs are not automatically changed.

The product suggestion endpoint passes the resolved primary category name to the engine. Requests that omit primary_category_id still use the saved primary category. The separate pending CatalogueManager source-key/body/label change is still needed to preview unsaved primary-category edits correctly.

The category rule editor now offers up to 50 actual assigned tag-model products for preview. It uses only the selected product's real brand, assigned active tags and active kind. No synthetic Example brand or master-vocabulary sample tags are inserted. With no assigned product, only the explicitly known category label is previewed; for a global rule with no product no name is invented. A category preview tests the selected category context, not a change to that product's stored assignment.

Thirteen pure naming/validator cases passed locally. Real-product selection queries, preview HTTP handling, DB authorization, TSX type-check, full backend/frontend suites, production build and browser checks remain unverified. This code patch applies no migration and changes no existing product or SKU rows.
