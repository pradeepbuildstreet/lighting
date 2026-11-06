# Catalogue group review - release integration

## Status
Partial implementation only. The mixed-decision policy is committed. This step adds existing audit-service exclusions and regression tests; it does not add group persistence, group API or group UI. The complete group-review feature is not enabled or verified.

## Decision contract
Support all-distinct groups, one retained primary with several duplicates, and multiple retained primaries with their own duplicates plus distinct products. Require one explicit disposition per product before final confirmation; unresolved products never receive implicit approval. Derive retain_primary only for retained records targeted by another group member. Other retained records receive approve_distinct; duplicates receive confirm_duplicate with a direct retained target. Retained activation stays manual. Do not merge or delete original records.

## Implemented in source
- Mixed-group policy and its 19 previously tested isolated cases.
- Existing audit run/review entry points reject confirmed duplicates and duplicate-linked subjects before any status reset or review insertion.
- New candidate scoring excludes confirmed duplicates and duplicate-linked records. Inactivity alone remains eligible.
- Review queue excludes duplicate-linked records; its existing status filter already excludes duplicate status.
- Existing single-product confirmation now requests deactivation as well as unpublication and records the deactivation in the audit log.
- When the jobs table is installed, confirmation holds that product's job, increments its generation and clears its lease, preventing old acknowledgements from matching it.
- Historical audit detail remains unchanged. Existing single-product targets still require active non-duplicate candidates; inactive retained targets require the future group endpoint.

## Snapshot and verification boundaries
The full-catalogue snapshot, digest format, synchronous 1000-record limit, scanned_count meaning and worker recovery counts are intentionally unchanged in this step. Duplicate rows are inspected for snapshot freshness but are not compared as new candidates. This preserves current completeness checks; it is not an eligible-only corpus optimisation.

Thirty-one isolated Node.js tests passed using mocked database calls and the required validation/policy helper logic in a temporary harness. They are not live PostgreSQL, trigger, worker-race, HTTP, browser, production-build or deployment tests. A source commit does not establish deployment. No database migration or live product decision is included.

## Required before enabling group review
- Add linked group-resolution persistence and retained-primary review evidence. Update database constraints, current_duplicate_approval and application publication checks without weakening other gates. Never send retain_primary to the existing single-product endpoint.
- Add authorized preview and atomic confirmation APIs with server-validated membership, full candidate coverage, current evidence/revisions, reviewer eligibility and existing lock order. Block approval for unresolved outside-group candidates. Persist group identity, notes, evidence and individual outcomes together; handle retries idempotently and stale submissions without partial writes.
- Permit inactive retained targets without activating them. Protect existing incoming duplicate links from becoming chains when a former primary is resolved elsewhere.
- Apply terminal exclusion consistently to scheduler/worker claims and recovery, not just service rejection. Protect duplicate decisions from implicit reopening through editor saves, imports and readiness reassessment; reversal must be explicit and audited. Expose read-only resolution history.
- If moving to an eligible-only corpus, version evidence scope and change scan counts and recovery checks together. Never rewrite historical audits as if they reviewed new evidence.
- Add group comparison UI, dispositions/targets, notes, complete confirmation summary, dirty/busy guards and stale-state handling.
- Run project regression suites, live-database rollback/constraint checks, worker-race and authorization tests, TypeScript/build and rendered-browser verification.
- Apply migrations and deploy only under separate reviewed approvals.

## Focused test commands
node --test backend/test/catalogue-group-review-policy.test.js
node --test backend/test/catalogue-tag-audit-integration.test.js
