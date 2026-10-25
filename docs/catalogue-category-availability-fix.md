# Category and availability correction

The live inactive-update failure was SQLSTATE 23514 on products_check1, not a hanging query. The earlier trigger migration did not remove the table-level active prerequisite. Migration 05 records the exact correction applied as 20261025231159. Only the active requirement was removed from the publication check constraint; approval, matching revision, approver and price remain required. Public visibility still requires active and published.

Product listings now select one image per product, preferring primary images, and render a lazy authenticated thumbnail with an unavailable-image fallback. Active updates have row-scoped busy/error/uncertain state. Confirmed database rejections release the controls; unknown outcomes require reloading that row's listing before another active update rather than blocking all catalogue work.

Categories contain the all-products group configuration and each saved category's local group assignments, removal and ordering. Group-only categories retain server-derived groups. Separate assignment navigation tabs are removed; old global/category assignment URLs resolve to Categories. Category and dealer editors render in a table row immediately after their selected record. Group drafts use server edit tokens and independent unsaved-change tracking.

Verification still required: full TypeScript/build suites, live image delivery, category group save/reload and hierarchy-derived behavior, and an approved test-product deactivate/reactivate cycle proving unchanged publication, identity, revision and approval. No live product data was changed as part of the schema migration or this code commit.
