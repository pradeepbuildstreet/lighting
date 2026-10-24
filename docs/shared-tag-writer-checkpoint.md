# Shared tag-product writer checkpoint

Staged library only: no current route imports these modules. The writer requires catalogue_taxonomy_versions=3, not yet installed; the installed storage prerequisite is version 2. Do not add the activation marker before the coordinated product-kind/publication/API cutover.

Manual entry and the pending Excel v2 committer must use this validator and transaction-scoped writer. One transaction acquires category then audit locks before product locks, validates the actor once, and serialises writes. Caught product-write errors still roll back the transaction. Await context operations; never reuse a context after its callback ends.

Common fields/categories are replacement data. Tags use preserve/merge/replace; supplying tags with preserve is rejected. Minimal measurements are typed, legacy descriptive fields are rejected, and active references are checked server-side. Existing inactive tags may remain in preserve/merge drafts, but cannot be newly assigned or published. Product-kind identity is immutable. The version-3 cutover must resolve the legacy product-kind constraint before enabling new kinds.

Category/tag writes are set-based and preserve primary-category uniqueness. Saves reset review/publication; core and relation writes can each increment revision. No-op approval preservation is not promised. Existing audit history and media are not deleted.

Validation: 36 pure/mocked tests plus syntax checks. Regression coverage includes valid numeric/string/zero/bounded prices and HTTP-400 invalid UUIDs, correcting two transcription defects caught in the earlier executable confirmation payload before any commit. PostgreSQL query execution, real concurrency, HTTP/auth/import/review integration, frontend build and live performance remain unverified.

The tag-aware scorer and Excel v2 parser are pending separate code checkpoints. Final activation also requires view/trigger/readiness/visibility changes, API/template/review/product-editor wiring and integration tests. Automatic compatibility and customer filters are unchanged.
