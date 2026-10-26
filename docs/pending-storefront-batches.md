# Remaining catalogue work

## Committed
- Part 1: category validation recovery, 57c952113992fed5ab3dcc1784ba0a63af91eec4. Live shutdown/restart diagnosis remains open.
- Part 2A: balanced portrait menus and category styling, fc3a4a9c4325d022e43d427c4fc08b212ca36d81. Browser/build verification remains open.

## Prepared before Part 2B
Two-row header: offset logo/search/reseller/buying guide/wishlist above single-row categories. Portrait submenu counts preserve backend category counts. Remove the redundant visible subcategory strip below the listing heading. Reuse the existing guide dialog in the header and remove its floating root instance. Reseller CTA is contact-only, with no account creation or pricing access. Eight isolated category-menu/source-contract checks pass; CSS syntax checks pass. Browser, TypeScript, build and deployment are not verified.

## Remaining Part 2B
Equal-height product cards, brand placeholders, bottom-aligned View product/enquiry counts, distinct price colour and elephant-grey card text. Guide placement is now part of the prepared menu patch, not an additional future task.

## Remaining Part 3
Incremental product loading with Load more/retry, stale-request cancellation, deduplication and return-to-list restoration. Preserve discovery three-row caps.
