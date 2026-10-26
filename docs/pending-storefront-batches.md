# Remaining catalogue work: tracked batches

## Part 1 - category validation recovery
Prepared changes: keep the 30-category cap; classify local input failures as recoverable status-400 validation errors; reject oversized category payloads before entering a database transaction. Preserve revision-conflict protection. Fifteen isolated model/route tests pass, including a valid request immediately after a rejected request. The route tests use mocked transactions, not a live database.

The existing selection handler already rejects a 31st category. The reported shutdown/restart behaviour has not been reproduced in a browser or traced to a server process failure. This patch fixes a confirmed editor-lock path; it does not establish that every reported restart cause is resolved. Runtime verification remains open. No database migration or live product update is included.

## Part 2 - navigation and presentation
- Remove stacked horizontal divider lines in the category/subcategory/toolbar area.
- Portrait category submenu: no more than ten rows; add columns and balance item counts across columns.
- Centre and evenly space menu items; wrap overflowing items to the next row.
- Use underline-only hover/focus emphasis with no filled submenu background. Preserve visible keyboard focus.
- Move category title, product count and description to the right; keep breadcrumbs and unshaded subcategories on the left.
- Use elephant-grey storefront text and a distinct accessible price colour.
- Equal-height cards: reserve brand space and align View product/enquiry counts at the bottom.
- Move How to buy below Wishlist in the header, reusing its existing guide dialog rather than adding checkout.
- Preserve mobile controls, existing public eligibility and Latest/Most enquired three-row caps.

## Part 3 - incremental listing
Replace listing pagination with incremental loading, retain a Load more/retry fallback, prevent duplicate or overlapping requests, cancel stale filter requests, reset on filter/sort changes and preserve return-to-list position. Keep the three-row cap on discovery sections, not the main listing. Browser, TypeScript, production-build and live-deployment acceptance must be reported separately.
