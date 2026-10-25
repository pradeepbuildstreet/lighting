# Standalone Reference Data

Reference Data is a top-level admin section beside Catalogue at /admin/reference-data. The existing taxonomy section key is reused for active navigation. Categories, filter-group assignments, vocabulary and dealers have one master UI, using the reference-only role of the shared manager; Catalogue no longer exposes or renders a nested Reference Data workspace. Legacy catalogue reference and taxonomy URLs redirect to the standalone owner. No master tables or data copies are created.

Categories use expandable parent/child rows, saved order columns, inline editors and category/all-products group controls. Display ordering integrates BulkOrderEditor for the complete category hierarchy, tag groups and product kinds. Nested tag ordering has a searchable parent-group selector, including inactive groups; every tag in the selected group participates in duplicate validation. Unsaved record/group/order edits are guarded when switching views. Category single-form saves also warn and block on currently loaded sibling-order conflicts; backend bulk validation remains authoritative.

Six isolated routing tests passed for the redirect/navigation model. Full TypeScript, production build and browser regressions remain unverified. Strong concurrency-safe duplicate enforcement for individual-record backend save paths is still outstanding.

Next implementation: one category/subcategory/tag/brand/attached-dealer browser and query model shared by Catalogue Products and Homepage Collections. This commit does not claim that browsing integration is complete. No live ordering or master values are changed by deploying this code alone.
