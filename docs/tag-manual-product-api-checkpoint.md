# Gated manual product API checkpoint

Base: release 4c31215bbfeb3d18735a7840035109491dea5818.

Mounted under the existing authenticated taxonomy router at /products-v2, before generic taxonomy routes: GET /state, GET /:id, POST / and PUT /:id. The parent requireAdmin/session/origin path is retained; the new router adds an admin-context/UUID check and private no-store responses. This is not a new independent authentication scheme.

Create envelope: {product:{...}}. Update envelope: {product:{...},expected_revision:"positive integer"}. Revisions accept positive safe integer numbers or canonical integer strings up to PostgreSQL bigint maximum; strings are preserved without Number coercion. Product fields are explicitly whitelisted; legacy specifications, product_kind, publication and approval/review fields are rejected. The shared writer owns full product validation, immutable kind, category/tag eligibility, revisions, approval invalidation and audit. No automatic audit, review or publication occurs. Common fields/categories are replacement updates; tag modes are preserve/merge/replace as defined by the shared writer.

Detail/create/update all use the existing shared writer transaction context. They remain unavailable until storage version 2, activation version 3 and the publication helper are present. The extra prerequisite check runs inside that transaction after its advisory locks. State is available before activation. Detail currently uses the same locked context, not a new lock-free read path; no performance claim is made.

Validation: 32 mocked Node router/envelope protocol tests and three syntax checks passed. Express/request/response and the writer transaction are doubles; sandbox validation uses extracted uuid/fail core functions. Committed tests use the repository core normally. Real HTTP/session/origin enforcement, mounted Express routing, PostgreSQL, shared normaliser/writer together, rollback/concurrency and frontend acceptance remain unverified.

No schema or activation changes. Existing manual editor/product routes, legacy imports, public catalogue, media, wishlist and main are unchanged. This exposes the new writer API; it does not switch existing live saves to it. Before activation, add legacy-write guards for tag-model products and switch the editor/upload workflows, then complete database and end-to-end acceptance. The pending SQL prerequisite remains unapplied and compatibility remains an explicit separate decision.
