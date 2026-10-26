# Customer filter workspace: first iteration

Frontend-only patch for release. No database or backend API changes.

Sections: Browse products; Price & brand; Refine by features. Applied selections and sorting live above results. Search, category scope, currency-dependent prices, pagination and product return URLs remain explicit. Desktop applies valid draft changes after a 500 ms debounce. Mobile uses a native modal dialog with an explicit Show products action and a cancellable debounced result-count preview. Closing without applying discards drawer changes.

Existing category/group applicability, contextual facet counts and OR-within/AND-across tag logic remain server-authoritative. Brand and product-kind controls remain single-select, matching the current API. Multiple values are supported within feature/tag groups. Category pages remain scoped to their route; subcategory navigation remains available above products.

Applied chips can be removed without opening a group. Clear filters retains search and the current category route. Clear search is separate. Currency removal clears dependent price ranges and price sorting. Sort and page-size controls are separate from filters. All filter navigations restart at page 1. No product-card, wishlist, image-zoom or publication-rule code changes.

Verification: 12 isolated Node model tests pass. Not yet verified: full repository tests, frontend TypeScript/Next production build, browser Back/Forward, modal focus/scroll behaviour and desktop/mobile visual acceptance. Those checks remain release gates, not claims of successful production operation.
