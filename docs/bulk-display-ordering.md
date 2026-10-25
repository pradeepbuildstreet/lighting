# Bulk display ordering — implementation part 1

GET and PUT /api/admin/catalogue/ordering/:kind are mounted after catalogue admin authentication. Supported kinds are categories, tag-groups, product-kinds, tags, collections and media. Categories without parent return the complete hierarchy; parent=root returns root siblings; parent=<UUID> returns immediate children. Tags require a tag-group parent and media requires a product parent. Inactive records are included.

GET returns the complete scope, saved order numbers and an edit token computed from PostgreSQL row snapshots. PUT accepts only edit_token and items[{id,sort_order}]. The full scope is required. IDs, integer ranges and unique sibling orders are validated before an UPDATE. Equal numbers in different parent scopes are valid. Locks serialize the snapshot check, batch update and audit transaction; failure rolls back the batch. Collections also increment their revisions and use their collection audit table. Existing trigger effects, including media review invalidation, are retained.

The standalone editor is /admin/reference-data/ordering. It shows saved/proposed values, expandable hierarchy, all-scope validation, explicit renumbering, save-all and discard/reload. Other scopes can use ?kind=tag-groups or ?kind=tags&parent=<group UUID>, etc. Membership order inside a collection remains its existing ordered product_ids list and is not replaced with a second numeric model.

Eleven isolated Node tests passed before this commit: eight validation/scope tests and three mock-transaction tests. They do not replace PostgreSQL concurrency/integration tests. TypeScript and production build have not been run.

Remaining implementation part: top-level Reference Data ownership/navigation, integration of this editor into master pages, category/tag/brand/dealer browsing shared by Catalogue and Homepage Collections, and consistent duplicate checks in individual-record save paths. No existing sort values are automatically rewritten by this commit.
