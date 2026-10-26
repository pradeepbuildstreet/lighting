# Two-row menu revision before Part 2B

Scope: first-row logo right-aligned within roughly the first fifth of desktop width, followed by search, Become a reseller, How to buy and Wishlist. Categories occupy one separate horizontally scrollable row; they never gain filled hover/selected backgrounds. Underline-only emphasis and visible keyboard-focus outlines remain. Portrait submenu balancing is unchanged and counts come directly from the validated category response, without summing overlapping category counts.

The redundant subcategory strip is hidden from both visual and keyboard navigation beneath the listing header. Desktop breadcrumbs stay left and title/count/description stay right; phone headings stack.

The buying guide reuses its existing dialog and now has one header-owned instance; the root floating instance is removed. Mobile exposes reseller and buying-guide actions from its menu. The reseller action is contact-only and uses the existing footer email and phone numbers; it creates no accounts, prices or records and makes no registration approval promise.

Verification: eight isolated category-menu and source-contract tests pass; the two changed CSS files parse successfully. These checks do not establish interactive browser behaviour, TypeScript validity, production build or deployment success. Those remain unverified release gates.

Remaining Part 2B: equal-height product cards, reserved brand space, bottom-aligned View product/enquiry counts, distinct price colour and elephant-grey card text. Part 3: incremental listing with retry and return-to-list restoration. The existing category-validation safeguards and discovery-row caps are not changed.
