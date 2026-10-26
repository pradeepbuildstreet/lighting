# Remaining catalogue work: tracked batches

## Part 1 - committed
Category validation recovery is committed at 57c952113992fed5ab3dcc1784ba0a63af91eec4. The 30-category cap, early API rejection and recoverable local validation are retained. Fifteen isolated tests passed before commit. The reported shutdown/restart has not been reproduced in a browser or traced to a process failure; runtime verification remains open.

## Part 2A - prepared navigation and heading styling
- Portrait submenus split entries into ceil(count/10) columns with balanced sizes differing by at most one, preserving their existing order. Ten entries fit one column; eleven split 6/5; twenty-one split 7/7/7.
- Dropdown placement is bounded to the viewport with internal scrolling when needed; desktop mouse, keyboard navigation, click toggles, Escape and outside-click handling are retained. Mobile keeps the existing category dialog.
- Menu items are centred with consistent gaps and wrap to further rows when necessary.
- Underline-only emphasis keeps font colour unchanged and removes filled submenu hover/focus backgrounds. Visible keyboard-focus outlines remain.
- Elephant-grey navigation and category-header text.
- Category title/count/description sit to the right on desktop; breadcrumbs and unshaded subcategories remain left. Phones use a single-column heading.
- Remove stacked rules around subcategories, feature headers/groups and the product toolbar.
Thirteen isolated menu-balancing/positioning tests pass. CSS syntax parsing passes. This is not a browser, TypeScript, production-build or deployment verification claim. No database or product-ranking changes.

## Part 2B - pending presentation tasks
- Equal-height product cards with reserved brand space and bottom-aligned View product/enquiry counts.
- Distinct accessible price colour and consistent elephant-grey card text.
- Move How to buy below Wishlist in the header, reusing its existing guide dialog.
- Preserve mobile controls, public eligibility and Latest/Most enquired three-row caps.

## Part 3 - pending incremental listing
Replace listing pagination with incremental loading, retain a Load more/retry fallback, prevent duplicate or overlapping requests, cancel stale filter requests, reset on filter/sort changes and preserve return-to-list position. The discovery-section three-row cap stays separate from the main listing. Browser, build and live-deployment acceptance must be reported separately.
