# Legacy product/import tag-model protection checkpoint

Base: release c57e548107b76fa285a557d5c97d4058a9afa91d.

The shared legacy product writer rejects persisted product_attributes or product_tags, including tag-only incomplete products, and non-legacy kind codes. It locks the product before the authoritative eligibility check and fails closed if that check returns no boolean. Rejection is HTTP-status 409 before product/spec/category writes. It does not depend on activation version 3: existing tag data must be protected even while activation is off. Genuine legacy fixture/light writes remain supported.

The legacy writer takes advisory lock 8102403 after category-policy validation has acquired 8102401. Legacy import commit now acquires 8102401 then 8102403 before locking the import job, matching v2 import/shared-writer/audit order. Locks can be reacquired within the same transaction. Additional serialization/lock waits have not been measured.

Legacy import preview uses the same guard as a row-level 400 validation error for existing tagged SKUs. A preview created before tagging still cannot commit afterward: the shared legacy writer checks again under locks. Preview checks are advisory, not a substitute for commit-time validation. Writer rejection propagates through the existing database transaction; actual PostgreSQL rollback remains unverified.

Legacy reload/commit reject jobs carrying the v2 metadata marker or ProductTags rows, before legacy replay or product writes. This protects stored job routing; it is not complete workbook-version dispatch. Valid legacy committed replay remains write-free. No new fallback to the legacy writer is added.

Validation: 28 passing isolated Node tests: 18 new guard/writer/import tests and 10 existing legacy-import service protocol regressions. Four JavaScript syntax checks passed. Validator and used category-policy functions were copied from repository source into the sandbox; database clients, workbook parser and selected transaction/writer dependencies are mocked. Parser-specific tests, real XLSX, SQL execution, HTTP, full repository suite/build, actual concurrent sessions, rollback and live performance/acceptance were not run. Lock-order tests verify calls, not absence of all possible deadlocks.

No database/schema/activation changes and no product conversion/deletion. Existing legacy editor endpoints remain, but cannot save a tag-model product through this writer. This is application-service protection, not a database-wide ban on every raw SQL or alternate writer. Product editor cutover, v2 upload UI, review evidence UI, pending SQL validation/application and coordinated activation remain outstanding. Media, compatibility,wishlist and main are unchanged.
