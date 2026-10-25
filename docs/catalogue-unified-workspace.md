# Unified Catalogue workspace

The default admin Catalogue route lists products, with paginated access to the complete catalogue. Each row shows review/publication/visibility reasons and View, Edit, Frontend Preview, Update Selling Price and Active/Inactive actions. Product selection replaces the listing, and Close restores the retained listing query/page and scroll context. Reference data, imports and review queue remain within the manager. Old tag-product entry URLs redirect into the manager rather than hosting a second editor.

View and Edit share selected-product sections for details, tags, media/SEO, dealers, and duplicate review/publication. View disables mutations; Preview is independent and uses CatalogueProductDetails, also used by the public product page. Its authenticated adapter reads tag-model saved data and private media; it never invokes the retired compatibility endpoint or exposes dealer quotes. Customer actions, public breadcrumb requests and compatibility requests are disabled in preview.

Content saves retain normal revision and review invalidation. Dedicated price and active actions use the operational endpoint and its optimistic token, not the content-save path. Price mode shows dealer net prices and their tax basis. The operational-status database migration was applied as 20261025223646.

Unsaved main fields persist between Details and Attributes & Tags. Other section transitions require saving or explicit discard. Dealer/review drafts are tracked by their section and protected on navigation. Conflicts and uncertain writes require reload. No automatic write retries are performed.

Verification pending: full backend suites, new pagination endpoint transaction tests, TypeScript check, production build and signed-in browser tests for every row action, close/return, dirty guards, tag applicability, media metadata read-back, price preservation, published deactivation/reactivation and preview private media. No passing test/build claim is made by this commit.
