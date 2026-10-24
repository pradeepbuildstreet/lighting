# Contextual catalogue editors: supporting components

Base reviewed: release ae4be9341456b01e5716703ca93734fd46ee44e5.

Adds InlineEditorRow, CatalogueReferenceForm and CatalogueProductForm for the existing catalogue administration screens. The row wrapper spans the supplied table columns, scrolls into view and focuses an enabled control on mount. Reference form covers categories, fixture/light types and dealers. Product form retains the existing legacy inputs, category repair controls, compatibility-related fields, JSON fields and revision information. Forms delegate saving/cancellation through callbacks rather than defining new API paths.

This supporting-components commit alone does NOT move existing editors. CatalogueManager integration is the next write: keep the product list visible while editing, render a single editor below the selected product/reference row, put New forms at the top, preserve dirty-navigation checks and return focus on close. Existing media/dealer/review workspaces must remain available. Saved records should stay in context.

Validation: eight passing Node source-contract tests only. They inspect structure and retained field names, not React rendering. TSX parsing/type checking, production build, browser focus/scroll and save/cancel integration remain unverified. No backend, database, activation, live save endpoint, media, wishlist or compatibility changes are included. The existing tag-taxonomy inline editor is untouched.
