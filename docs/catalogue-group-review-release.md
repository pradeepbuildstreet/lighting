# Catalogue group review - release integration

## Status
Partial implementation, source only. Group policy, audit-service exclusion, atomic group API, retained-primary publication checks, UI draft and migrations 13/14 are committed. This step supplies transaction-level worker lease guards. Worker call-site wiring/claim filters are the next dependent commit and are NOT included here; the current worker race must not be described as fixed yet. No migration has been applied and no deployment has been verified.

## Audit-write lease interface
Internal run options now accept jobLease alongside refreshAuditId. Internal review options accept jobLease alongside automated. When supplied, a lease must match the product, exact revision, originating actor, processing status, generation, token and unexpired lease_until. The service checks it after shared advisory locks, actor validation and product row locking, using the same transaction client and a job-row FOR UPDATE lock before any audit/review/product write. Null or malformed supplied leases fail closed; bigint generations retain exact decimal strings.

Leased automatic initial audits cannot replace an approved product or a recorded review of the current revision. Automatic refresh retains the existing current-audit/unreviewed/pending-review restrictions. Approval retains current evidence, model, enabled-auto-approval, complete scan and zero-candidate requirements. Explicit manual operations retain their existing interface; public routes do not accept worker options from request bodies.

## Next worker integration
Every worker initial run, bounded refresh and automatic review must pass the immutable claimed lease. Claim SQL must exclude duplicate status and duplicate links without excluding legitimate inactive products. The post-claim state check must also recognize duplicate links. Lost leases must not trigger the evidence-refresh path. Existing held-recovery, bounded retry and generation/token acknowledgement checks must remain. These caller changes are prepared separately, not enabled by this guard-only commit.

## Database and UI boundaries
Read-only schema inspection confirmed missing group tables and exposed identity invalidation, scheduling and database reassessment gaps. Migration 14 addresses those gaps in source and requires migration 13. Both require disposable PostgreSQL execution, rollback, permission and concurrency tests before live application. The group UI draft is not TypeScript/build/browser verified. Exact request recovery is not a substitute for end-to-end save tests.

## Verification
The 13 audit-write lease regression cases passed in a temporary Node.js harness with mocked SQL/actor transactions, injected scoring, required validator/policy helper logic, and the recorded evidence/clean-audit implementations. They cover scope/ownership/expiry-result rejection, exact bigint generation handling, stale-run/refresh/review rejection before writes, current approval/manual-review protection, successful clean approval and simulated generation invalidation. They do not prove actual PostgreSQL row-lock/expiry/concurrency behaviour. A separately prepared combined worker draft also passed focused harness checks; it is not part of this commit.

## Remaining before release enablement
- Commit worker wiring, claim filtering and their regression updates; run real two-worker/group-confirmation races with transaction rollback assertions.
- Execute and validate migrations 13/14 on disposable PostgreSQL against the inspected schema, including editor/import/media/reference/pricing paths.
- Add explicit audited reversal and read-only resolution history; ordinary writes must not serve as reversal.
- Type-check/build the frontend and exercise rendered group selection, comparisons, mixed decisions, outside scope, navigation, stale previews, timeout/reload/exact retry and receipts.
- Run full project and HTTP authorization regressions. Drain old workers during a separately reviewed rollout.
- Apply migrations, deploy and make live product decisions only under separate exact-action approvals.

## Focused audit-write tests
node --test backend/test/catalogue-worker-lease.test.js
