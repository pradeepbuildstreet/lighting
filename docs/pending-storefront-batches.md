# Remaining catalogue work

## Committed
- Part 1: category validation recovery, 57c952113992fed5ab3dcc1784ba0a63af91eec4. Live shutdown/restart diagnosis remains open.
- Part 2A: portrait menus/category styling, fc3a4a9c4325d022e43d427c4fc08b212ca36d81.
- Two-row header, counts, reseller contact panel and buying guide: 0db5130fa59328137dc84878c6c71e62495ea8e7.
- Header-quarter/divider correction: 927c301c377f00c7f9064c59dfef349812676ff4.
Build, interactive browser and live-deployment verification are not established by these commits.

## Part 2B - prepared card presentation
Shared customer product cards have fixed heights within desktop/mobile breakpoints, fixed image/title/identity/brand slots, a visible Brand: — placeholder and a bottom-pinned View product/enquiry-count footer. Two enquiry-text lines are reserved for loading, ready and unavailable messages. Long titles are visually limited to two lines while complete text remains in the DOM and title attribute; SKU/kind and brand use single-line ellipsis with complete title text. Elephant-grey text and a distinct terracotta price colour are scoped to cards.

Product routes, wishlist controls, lazy thumbnail/fallback behaviour and real enquiry-count loading remain unchanged. Normal listing pagination is not capped; Latest/Most enquired retain the responsive three-row caps. No header, database, price calculation, saved product record or ranking query changes.

Eight isolated brand-display/source-contract/colour-contrast checks pass, and both changed CSS files parse. These are not TypeScript, Next production-build or rendered browser tests; visual alignment, responsive layout and live deployment remain unverified.

## Part 3 - pending
Incremental product loading with Load more/retry, stale-request cancellation, deduplication and return-to-list restoration. Preserve discovery three-row caps.
