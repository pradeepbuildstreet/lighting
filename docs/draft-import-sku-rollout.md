# Draft import and lifetime SKU rollout

Status: database foundation staged only. Neither migration has been applied by this commit. The review form, API, new workbook, image staging, name-rule UI and master export are not implemented by these files.

## Identity contract

Keep existing UUIDs internal. Do not add a product key or shorten UUIDs. New imported drafts may eventually have NULL SKU and name. Assign SKU only on an explicit authenticated review-form save; names remain editable and can be suggested from brand, tags and kind. Existing SKUs are preserved and become immutable when migration 07 is applied.

Exactly three uppercase initials: fixture FIX, integrated-light INL, replaceable-bulb RBL, led-strip-module LSM, driver-power-supply DPS, control-accessory ACC. Inactive kinds are not activated. New kinds require an explicit unused three-letter prefix before SKU allocation. One global six-digit sequence starts at 100001, producing FIX100001, RBL100002, etc. It stops at 999999 rather than wrapping. Gaps are expected. No allocation happens during workbook parsing, preview or page opening. Existing collisions are skipped, with a bounded failure after 100 attempts.

## Deployment order

1. Review migration 06 independently: it removes the remaining product-activation predicate in check_publish while retaining review, price, category, image, model and audit requirements. Active-dealer and public-visibility rules are unchanged.
2. Prepare application compatibility for nullable draft SKU/name before applying 07: normalizers, API types, browser/search/sort/display fallbacks, duplicate audit, preview, export, and publication readiness. The current application still requires SKU/name and is not yet compatible with the full workflow.
3. Run migration and integration tests in an isolated database, including parallel assignments, authenticated-role permission tests, stale saves, legacy SKU preservation, publication gates and sequence exhaustion. The supplied SQL smoke test has not been executed and consumes sequence values even after rollback: never run it on production.
4. Apply 07 through a transactional migration runner with separate approval. Verify backend role privileges explicitly. The allocator is SECURITY INVOKER and PUBLIC has no execution/sequence permission; grant only the actual trusted backend role if needed. Do not expose direct anonymous/authenticated RPC access.
5. Wire the authenticated assignment endpoint inside an audited transaction. Assignment is distinct from content saving: returning an existing SKU does not authorize a stale content overwrite. Keep revision checks on content updates. New bulk drafts must default inactive to respect the current active-dealer constraint.
6. Enable the new workbook version only after form/backend coverage: row 1 allowed values, row 2 stable headers, row 3+ data; comma-separated tag/image lists; server validation; selected-folder file staging; unpublished draft creation; no SKU/name requirements in create upload.
7. Add master export/update for assigned products only, matched by SKU plus expected_revision; reject missing/unknown SKU and never fall back to create. Existing version-2 semantics must not silently change.

Pending tests: SQL smoke test, concurrent database tests, backend suite, frontend suite, type-check, production build and browser regression. No live product rows or schema are changed by committing these files alone.
