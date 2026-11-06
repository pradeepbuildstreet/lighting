# Catalogue group review - release integration

## Status
First implementation step only. The policy and its isolated tests are prepared; no runtime API, UI, worker or database integration is included in this step. This feature must not be described as complete or enabled.

## Decision contract
A group can contain all-distinct products, one retained primary with multiple duplicates, or multiple retained primaries with their own duplicates plus distinct products. Final confirmation requires one explicit disposition for every product. Unresolved products block final submission; they are never default-approved. The server derives retain_primary only for retained records targeted by another group member. Other retained products receive approve_distinct; duplicate records receive confirm_duplicate and a direct retained target.

Confirmed duplicates are inactive and unpublished. Retained-product activation remains manual. This action does not merge or delete records or move dealer records, images, enquiries or quotations. Normal publication readiness remains mandatory.

## Completed preparation
- Mixed-group decision validation and duplicate eligibility policy.
- Nineteen isolated Node.js policy tests passed in the preparation environment.
- Self-links, cycles, chains, outside-group targets, missing decisions, repeated decisions and stale revisions are rejected.
- Confirmed duplicate status OR a duplicate target excludes a record; inactivity alone does not.

## Required before enabling
- Add a migration for linked group resolutions, individual decisions and retained-primary evidence. Update review constraints and current_duplicate_approval without weakening existing publication guards. Do not submit retain_primary to the existing single-product endpoint.
- Build the authenticated, authorized group preview and atomic confirmation API. Revalidate complete current evidence, revisions, candidate coverage and reviewer eligibility under the existing lock order. Recheck the group server-side; client-provided membership and revisions are not sufficient evidence. Unresolved candidates outside the reviewed scope must block approval, not silently become distinct.
- Persist group identity, reviewer, notes, reviewed evidence and individual outcomes in one transaction. Handle retries idempotently and reject stale submissions without partial writes. Retained targets may be inactive. Protect existing incoming duplicate links from becoming chains if a former primary is later resolved elsewhere.
- Exclude confirmed duplicates consistently from queue membership, manual audit subjects, candidate scans, background scheduling, worker claims, recovery paths and clean-audit scan counts. Revalidate job generations so stale workers cannot undo a group resolution.
- Version evidence scopes as necessary; never rewrite historical audits as though they had reviewed new evidence. Protect confirmed duplicates from implicit reopening through editor saves, imports, automatic readiness or reruns. Reversal must be explicit and audited. Preserve historical evidence and provide read-only resolution history.
- Add group comparison UI, explicit dispositions and targets, notes, complete confirmation summary, busy/dirty guards and stale-state handling. Do not present a retained primary as distinct from its known duplicates.
- Add transactional integration, database guard, worker-race, eligibility parity, publication, HTTP authorization and UI tests. Run project suites, TypeScript/build and rendered-browser checks.
- Apply database changes and deploy only under their own reviewed approvals. No live product decisions or database changes are authorized by the source-code preparation commit.

## Isolated verification
Run: node --test backend/test/catalogue-group-review-policy.test.js
This validates only the pure policy. It does not demonstrate that production review cycles exclude duplicates or that group review is available in the UI.
