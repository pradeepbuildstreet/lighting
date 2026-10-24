# Single Reference data submenu: supporting changes

Base: release 8aed81ef308db8d64f3ecacb879a577254633225.

Adds validated mapping between the existing catalogue reference tabs and taxonomy sections. Category records remain distinct from category tag-group configuration; old taxonomy category/global bookmarks have explicit mappings. Existing referenceLinks exports are retained for compatibility until the visible navigation cleanup.

TaxonomyManager gains optional embedded mode and dirty/busy reporting. Embedded mode suppresses its standalone header/back link/tab bar and delegates external navigation protection to the parent; its root becomes a section rather than nesting a main element. Standalone defaults remain unchanged. Data loading, active-group requirements, edit tokens, inline forms, save APIs and validation are unchanged. The parent integration must pass a stable state callback, protect dirty reference changes and block navigation while saving.

This support commit alone does NOT remove the duplicate menus. The next commit mounts taxonomy editors only inside the existing styled Reference data submenu, removes the global Tags & groups item and the separate link row, moves the product-editor link into Products, and redirects taxonomy bookmarks to that workspace.

Twenty-nine Node navigation-model tests passed: 13 consolidation mappings plus 16 existing link tests. These do not verify React effects, TypeScript, Next build, browser dirty-state handling or live deployment. No completed CI/build result is claimed. No backend, database, activation, main, wishlist or media changes. Customer listing filters remain unwired to product_tags; administrative group configuration is not an active customer tag filter.
