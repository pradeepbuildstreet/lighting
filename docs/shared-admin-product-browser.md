# Shared admin product browser

One read-only query service backs POST /api/admin/catalogue/product-browser/query and the legacy GET /product-workspace alias. The POST performs only reads; it avoids oversized URL query strings for grouped tags or up to 500 selected IDs. Both routes are mounted after admin authentication. Filter-option endpoints return categories, brands, attached-dealer masters, tag groups and tags. Bounded option searches explicitly report further matches.

Category selections include descendants with cycle/depth guards. Values within a dimension are alternatives; different dimensions and different tag groups combine with AND. EXISTS predicates prevent duplicate product rows from multiple category/dealer/tag attachments. Defaults include inactive and unpublished products. Product state, publication and prices are never modified by browsing. Optional enquiry counts fail independently rather than returning a fabricated zero.

AdminProductFilters and queryAdminProducts are reusable client controls/transport. Homepage Collections now uses them with thumbnails, pagination, selected-only browsing and explicit add-current-page behavior. Its membership array remains independent of result/filter state, and is saved only by Save collection.

Twelve isolated query-model tests passed before commit. PostgreSQL integration, TypeScript/build and browser tests remain unverified. Catalogue already uses the common backend via its legacy list alias, but wiring AdminProductFilters into CatalogueManager is the next commit. Individual-record ordering safeguards are a separate outstanding item. No live product, collection or reference records are changed by this commit.
