# Catalogue group review - release integration

## Status
Partial implementation. Decision policy and existing audit-service exclusion are committed. Migration 13 now supplies group persistence and database retained-primary approval support as source only. It has not been applied or validated by PostgreSQL. Group API/UI and application publication support remain pending; this is not an enabled feature or deployment.

## Decision contract
Support all distinct, one retained primary with several duplicates, and multiple duplicate clusters plus distinct products. Require explicit decisions for every member. Derive retained-primary labels from incoming duplicate targets; reject self-links, chains, cycles and outside-group targets. Keep retained activation unchanged. Disable and unpublish duplicates without merging or deleting their records.

## Source implementation
- Mixed-group validation policy with 19 previously tested isolated cases.
- Audit-service subject/review guards, candidate and queue exclusion, duplicate deactivation and job-generation invalidation. Thirty-one isolated tests previously passed with mocked database calls and helper logic.
- Migration 13 adds group headers, linked per-product decisions, reviewer-bound request keys/digests and reviewed snapshots. It adds a group link and retained-primary decision to individual reviews.
- Deferred checks require all members and individual reviews, matching audit/reviewer/revision/evidence, direct primary targets, correct current product states and preserved retained activation. Existing incoming duplicate links must be explicitly reassigned before replacing their primary.
- New group history and linked individual reviews reject updates/deletes. New tables enable RLS and revoke browser-role privileges. Deferred checks require the originating active administrator.
- Database approval retains existing subject/revision/latest-audit/reviewer checks and permits retained-primary evidence only through its exact group item with an actual duplicate target.
- Historical audits are not rewritten. Existing full-catalogue snapshot/count semantics and the 1000-record limit remain unchanged. Inactive legitimate records remain eligible.

## Verification limits
Fourteen source-contract tests passed for the migration text. No PostgreSQL parser or execution validation was available in the preparation environment. These checks do not prove SQL/PLpgSQL validity, rollback behaviour, constraint timing, permissions, concurrency or compatibility with the actual deployed schema. Migration 13 requires disposable-database execution and negative-case tests before any live application. Do not apply this to production on the strength of source checks alone.

## Remaining before enabling
- Implement authorized preview and atomic group confirmation with server-validated scope, full candidate coverage, evidence/revision freshness, notes, lock order, idempotent retries and no partial writes. Use new per-product audits/reviews bound to the shared reviewed corpus digest. Preserve retained activation, disable duplicates, and invalidate affected jobs.
- Update application publication/readiness checks for validated retained-primary evidence. The existing application still rejects that review decision; database support alone must not be treated as enablement.
- Add explicit audited reversal; ordinary editor/import/readiness paths must not implicitly reopen confirmed duplicates. Add read-only resolution history. Finish scheduler/worker claim and recovery filtering.
- Add group comparison UI, dispositions/targets, confirmation summary, notes, dirty/busy protection and stale-state handling.
- Run PostgreSQL positive/negative/rollback tests, project regressions, HTTP authorization, worker-race tests, TypeScript/build and browser checks.
- Apply migrations and deploy only under separate reviewed approvals. No live product records are changed by committing this migration file.

## Focused checks
node --test backend/test/catalogue-group-review-policy.test.js
node --test backend/test/catalogue-tag-audit-integration.test.js
node --test backend/test/catalogue-group-review-schema-contract.test.js
