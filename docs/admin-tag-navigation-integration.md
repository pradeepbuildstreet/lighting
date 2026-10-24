# Admin tag reference navigation integration

Base reviewed: release 3605c33b4fd705f84307e66f165ee995ffb96607.

Adds a first-class Tags & groups item to shared admin navigation and highlights that section on taxonomy pages. Replaces the buried catalogue text link with a clearly labelled Reference data navigation section containing Tag groups, Tags, Product kinds, category/global tag groups and the existing category/type/dealer links. This makes tag management discoverable from normal admin navigation while reusing its existing management route; it does not embed taxonomy forms into the legacy category/type/dealer table.

The taxonomy page validates the section query parameter server-side, supplies the selected initial tab and keys the manager by section. Group/tag deep links therefore open the requested tab without client hydration defaults or manually clicking another tab. Add controls are labelled Add tag group / Add tag / Add product kind. Tags still require selecting an active group before creation. Existing inline editing, APIs, validation and audit handling are unchanged.

Sixteen real Node navigation-model tests passed. TypeScript/TSX, Next build, active-nav styling, authenticated live navigation and creation/persistence were not tested in this sandbox. The release push triggers the configured auto-build/deployment; no completed build/deployment result is claimed. This patch has no backend, database, product/import activation, main, media or wishlist changes. Reference management remains independent of the later product-model activation.
