# Catalogue group review - release integration

## Status
Partial implementation, source only. The worker now passes claimed leases to the previously committed audit-write guards, and claim SQL excludes confirmed duplicates. These source changes connect the two halves of worker protection, but real PostgreSQL locking and group-confirmation races remain release blockers. Migrations 13/14 are unapplied and not execution-validated. The UI is not TypeScript/build/browser verified. No completed feature or deployment is established.

## Worker integration
Initial runs, automatic reviews and the single bounded evidence refresh each receive an immutable jobLease containing product ID/revision, actor, exact generation string and token. Unsafe numeric identities fail before service calls. The audit service verifies supplied ownership/status/expiry under the shared advisory locks, actor validation, product lock and job-row lock in the write transaction. Stale leases are not evidence-freshness errors and cannot start a refresh.

Claim SQL checks both terminal review status and duplicate_of_product_id and deliberately has no product-active filter. A duplicate link appearing after claim also blocks routing. Existing actor checks, held-recovery restrictions, complete-catalogue scan counts, retry bounds and generation/token acknowledgement guards remain. Explicit manual fresh audits keep their separate user-authorized interface; worker options are not accepted from public request bodies.

## Group and database protections
The source workflow supports mixed groups, direct retained targets, explicit decisions, comparison acknowledgements, notes, full summaries, stale-preview rejection, atomic group recording and exact-key retry recovery. Application publication binds retained-primary decisions to exact group evidence without activating products. Customer visibility retains all activity/dealer/eligibility checks.

Read-only schema inspection found missing group tables and identity invalidation, scheduling and automatic reassessment gaps. Migration 14 addresses those gaps and depends on migration 13. Both are source drafts only and have not been applied. Ordinary writes must not serve as duplicate reversal; explicit audited reversal and read-only history are still pending.

## Verification boundaries
This step passed 26 isolated Node.js checks in a temporary harness: eight existing worker cases, eleven worker-routing cases from the stale-audit fixture, and seven new binding/source cases (24 mocked behavioural cases plus two source checks overall). The complete updated stale-audit file passed a syntax check; its six VM-based audit-service cases were not rerun in this step. Earlier work separately exercised 13 audit-write lease cases. These are not live database, real expiry/lock timing, concurrent-worker/group-write, HTTP authorization, full-project, rendered UI, build or deployment tests.

## Remaining before release enablement
- Run complete worker/audit suites and real two-worker versus group-confirmation races, including lost acknowledgements, expiry during lock waits, generation replacement and transaction rollback.
- Execute migrations 13/14 on disposable PostgreSQL with positive/negative, ordering, trigger and permission tests; verify editor/import/media/reference/pricing paths against the guards and inspect deployment-schema compatibility.
- Add explicit audited reversal and read-only resolution history.
- Type-check/build the frontend and test rendered selection, comparisons, mixed outcomes, outside scope, navigation, stale previews, timeout/reload/retry and receipts.
- Run full project and HTTP authorization regressions; drain old workers during a separately reviewed rollout.
- Apply migrations, deploy and make live decisions only under separate exact-action approvals.

## Focused worker commands
node --test backend/test/catalogue-duplicate-worker.test.js backend/test/catalogue-worker-binding.test.js backend/test/catalogue-worker-lease.test.js backend/services/catalogue-stale-audit.test.js
