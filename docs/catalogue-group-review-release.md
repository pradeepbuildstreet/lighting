# Catalogue group review - release integration

## Status
Partial implementation, source only. Mixed-decision policy, existing audit-service exclusion, migration 13 and group preview/confirmation API are now supplied. Migration 13 is not applied or PostgreSQL-validated. Group UI and application retained-primary publication support remain pending. This is not an enabled/deployed feature.

## Group API contract
Mounted under the existing admin-protected catalogue router:
- POST /duplicates/groups/preview with product_ids.
- POST /duplicates/groups/confirm with product_ids, preview_token, request_key, notes and one decision per product.
Each decision supplies product_id, revision, disposition (retain or duplicate), and an optional duplicate_of_product_id. The server derives approve_distinct, retain_primary and confirm_duplicate. Support multiple clusters plus distinct products. The synchronous endpoint accepts 2 to 50 members and inspects the complete catalogue up to the existing 1000-record limit.

Preview makes no product/review writes. Confirmation validates the live originating administrator, current tag model, migration prerequisite, complete selected scope, comparison evidence, latest audit/review identities and product state. Outside-group candidates block submission. Known duplicates cannot be subjects or matching candidates. Retained targets may be inactive; activation stays unchanged.

Confirmation creates a shared group resolution and new individual audits, candidates, reviews and group items in one transaction. It unpublishes products pending normal readiness checks, approves retained members and deactivates confirmed duplicates. It invalidates job generations/leases and records per-product audit logs. Deferred group constraints are forced before returning. Identical reviewer-bound request-key retries return the stored result; different payloads with that key are rejected. Existing primary links cannot silently become chains. This is not a merge or deletion action.

## Persistence and publication boundary
Migration 13 supplies linked group evidence, deferred completeness/state checks, history protections and a database retained-primary approval branch. The existing application publication service still rejects retained_primary. Do not equate database approval support or this API with complete publication integration. Existing full-catalogue digest/count semantics are preserved; historical audits are not rewritten. The API fails closed without migration 13.

## Verification
- Previously: 19 isolated policy tests and 31 mocked audit-service cases passed in preparation.
- Previously: 14 migration source-contract checks passed; no PostgreSQL parser/execution validation was available.
- This step: 18 isolated group-service cases passed in a temporary harness using mocked transactions and the required validator/policy/evidence helper logic. Simulated rollback is not proof of PostgreSQL rollback/trigger behaviour.
No full project suite, real PostgreSQL, trigger/permission/concurrency tests, HTTP authorization tests, production build, browser tests or deployment verification has been established for this feature.

## Remaining before release enablement
- Execute migration 13 and negative/rollback cases on a disposable database; check against the actual deployed schema. Do not apply it live based only on source-contract checks.
- Update application publication/readiness for exact validated retained-primary evidence without weakening price, model, category, image or saleability gates.
- Add group comparison/selection UI, explicit decisions/targets, notes, full confirmation summary, dirty/busy protection, stale-state recovery and stable request-key retry behaviour.
- Finish scheduler/worker claim/recovery filtering and prevent editor/import/readiness paths from implicitly reopening duplicates. Add explicit audited reversal and read-only resolution history.
- Run project, HTTP/admin authorization, real database, worker-race, TypeScript/build and rendered-browser checks.
- Apply migrations, deploy, and make live product decisions only through their own reviewed approvals.

## Focused tests
node --test backend/test/catalogue-group-review-policy.test.js backend/test/catalogue-tag-audit-integration.test.js backend/test/catalogue-group-review-schema-contract.test.js backend/test/catalogue-group-reviews.test.js
