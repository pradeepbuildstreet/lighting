# Catalogue group review - release integration

## Status
Partial implementation, source only. Policy, audit-service exclusions, migration 13, group preview/confirmation API and application retained-primary publication validation are supplied. Migration 13 is not applied or PostgreSQL-validated. Group UI, full duplicate-terminal protection and end-to-end verification remain pending. This is not a completed feature or deployment.

## Current source behaviour
Group API endpoints are POST /duplicates/groups/preview and POST /duplicates/groups/confirm under the existing admin-protected catalogue router. Groups accept 2 to 50 explicit products within the existing complete-catalogue 1000-record scan limit. Mixed clusters and distinct products are supported. Every member needs a decision. Outside-group candidates, stale evidence, newer manual reviews and invalid targets block submission. Reviewer-bound request keys support identical retries without new writes.

Confirmation records the group, new audits/candidates, individual reviews and item snapshots together. It preserves retained activation, disables/unpublishes duplicates, invalidates job generations and checks deferred group constraints. Historical audits are not rewritten. The full-catalogue snapshot/count semantics remain unchanged.

Application publication now accepts retain_primary only after exact group/product/revision/audit/review/reviewer/digest/algorithm binding and a positive current_duplicate_approval database check. A retained-primary label alone, a missing group prerequisite or any non-boolean approval result fails closed. All existing price, current approval, audit, model, category and image checks remain. Ordinary distinct reviews and unpublication remain compatible with pre-group schemas.

Publication and activation stay separate. This change does not activate products. Existing customer visibility still requires active status, an active dealer and all other eligibility/view checks. Legacy inactivity expectations and a missing active-dealer flag in a visibility test fixture are corrected; the visibility implementation is unchanged.

## Verification boundaries
Earlier preparation passed 19 policy cases, 31 mocked audit-service cases, 14 migration source-contract checks and 18 mocked group-service cases. This step passed 77 focused tests: 35 group-publication, 17 existing publication and 25 tag-publication/visibility cases, in a temporary harness with mocked SQL/actor calls, equivalent required validator helpers, the actual visibility implementation and stubbed unused compatibility-warning integration. These are not live PostgreSQL, SQL/trigger execution, full-project, HTTP authorization, concurrency, browser, build or deployment verification.

## Remaining before release enablement
- Run migration 13 positive/negative/rollback and permission tests on a disposable PostgreSQL database; check against the actual deployed schema. Do not apply it live based on source-text checks.
- Implement the group-review UI with selection/comparison, per-product dispositions, retained targets, notes, complete confirmation summary, dirty/busy guards, stale-preview recovery and stable retry keys.
- Finish scheduler/worker claim/recovery exclusions and prevent editor/import/readiness paths from implicitly reopening duplicates. Add explicit audited reversal and read-only resolution history.
- Run complete regressions, HTTP/admin authorization, real database, worker-race, TypeScript/build and rendered-browser tests.
- Apply migrations, deploy and make live product decisions only under their own reviewed approvals.

## Focused publication tests
node --test backend/test/catalogue-group-publication.test.js backend/test/catalogue-publication.test.js backend/test/catalogue-tag-publication-app.test.js
