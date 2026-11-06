# Catalogue group review - release integration

## Status
Partial implementation, source only. Policy, audit-service exclusions, migration 13, atomic group API, application retained-primary publication validation and group-review UI draft are supplied. Migration 13 is not applied or PostgreSQL-validated. The UI is not TypeScript/build/browser verified. Duplicate-terminal protection and release verification remain pending. This is not a completed or deployed feature.

## Review UI
The independent duplicate-review workspace now has Single product review and Group review modes. Group mode uses the shared product browser (including approved/inactive retained targets) and existing image comparison. Select 2 to 50 products, load a preview, include outside candidates and refresh as necessary, assign every product retain or duplicate, select direct retained targets, acknowledge comparison for every member and enter notes. No product is approved by default. The full confirmation summary identifies products and targets; retained activation remains unchanged and duplicates are disabled/unpublished.

Scope changes require discarding existing decisions/notes. Busy and dirty state feed the shared navigation guard. Preview membership and returned decision outcomes are checked. Confirmation saves its exact body and request key in session storage before sending. After an uncertain response the UI locks editing and offers only exact-request retry or explicitly warned local recovery-data discard. Reloading group mode restores valid saved recovery data. Discarding local recovery is not a reversal of a recorded decision. Session storage must be available before a confirmation can be sent.

The existing catch-all API forwarder passes the authenticated group routes; no new proxy route is added. Migration prerequisites still fail closed. Group API scope, full-catalogue freshness/count semantics, idempotent retries and application publication binding remain as implemented in earlier commits. Publication does not activate products; customer visibility still requires activity, active dealer and all other eligibility rules.

## Verification boundaries
Earlier steps passed 19 policy, 31 mocked audit-service, 14 migration-text, 18 mocked group-service and 77 focused publication/visibility cases in their preparation harnesses. This UI step passed 21 Node.js checks: 16 executable decision/recovery helper cases and five source-wiring checks. These are not React rendering or interaction tests. No TypeScript compiler was available in the preparation environment; TSX compilation, type checking, Next production build and browser verification have not been performed. No PostgreSQL execution, HTTP authorization or concurrency verification is established for the complete feature.

## Remaining before release enablement
- Run migration 13 positive/negative/rollback/permission tests on disposable PostgreSQL and check the actual deployment schema before any live application.
- Type-check and build the frontend; test rendered selection, comparison, mixed decisions, outside-candidate handling, dirty navigation, stale previews, timeout/reload recovery, identical retry and result receipts.
- Finish scheduler/worker claim/recovery exclusions and guard editor/import/readiness paths against implicit duplicate reopening. Add explicit audited reversal and read-only group-resolution history.
- Run complete project, HTTP/admin authorization, real database and worker-race regressions.
- Apply migrations, deploy and make live product decisions only under separate reviewed approvals.

## Focused UI helper/source checks
node --test frontend/app/admin/catalogue/group-review-state.test.mjs
