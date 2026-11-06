# Catalogue group review - release integration

## Status
Partial implementation, source only. Decision policy, audit-service exclusions, atomic group API, application retained-primary publication validation and UI draft are committed. Migrations 13 and 14 are source drafts, not PostgreSQL execution-validated or applied. The UI is not TypeScript/build/browser verified. This is not a completed or deployed feature.

## Installed-schema inspection
A separately approved read-only Supabase inspection of luminoza on 2026-11-06 confirmed that group tables are absent. It also found that product_identity_changed resets identity edits to draft, catalogue_enqueue_duplicate checks review status but not the duplicate link, and catalogue_reassess_product explicitly requires approve_distinct. The existing invalidate_product already preserves duplicate/rejected/archived status. Only schema definitions were read; no product records were read or changed.

## Migration 14 source changes
Requires migration 13's group tables, review link and approval-policy version plus the existing pipeline. It patches exactly one inspected clause in each of identity invalidation, duplicate enqueueing and publication reassessment, preserving installed function attributes and unrelated logic. Unexpected or repeated clauses fail closed rather than silently rewriting an unknown definition.

Identity changes preserve duplicate status when either the old status or old duplicate link identifies a confirmed duplicate. A late BEFORE ROW product guard blocks ordinary reopening/retargeting, requires consistent duplicate status and keeps affected duplicate writes inactive/unpublished with approval fields cleared. A job guard holds jobs for confirmed duplicates and clears their leases, advancing generation on updates. No existing product records or jobs are backfilled by this migration. Existing inconsistencies require separately reviewed remediation; the migration does not invent a primary target.

Database reassessment now recognizes retained-primary reviews only with a group link, matching reviewer and current_duplicate_approval validation. Existing price, dealer pricing, category, image, model and current-revision checks are preserved by the narrowly scoped replacement. Migration 13 alone is not sufficient for automatic retained-primary reassessment in the inspected schema.

## Existing group workflow
The group UI/API supports 2 to 50 explicit products within the complete-catalogue 1000-record limit, mixed duplicate clusters plus distinct products, explicit per-product decisions, image comparison, outside-candidate blocking, notes, exact confirmation and preserved retained activation. Unknown confirmation outcomes retain the exact body/key for replay. Application publication validates exact group evidence. Customer visibility remains separate and requires activity, an active dealer and other eligibility rules.

## Verification limits
Earlier preparation checks: 19 policy, 31 mocked audit-service, 14 migration-13 text checks, 18 mocked group-service, 77 focused publication/visibility and 21 UI-helper/source checks. This step passed 14 additional Node.js source-contract checks for migration 14. These checks inspect source text; they do not establish SQL/PLpgSQL validity, trigger execution, security, concurrency or deployed behaviour. Read-only schema inspection is not a migration execution test.

## Critical remaining work
- Implement worker claim exclusion and lease/generation validation inside the same locked audit-write transaction. Job acknowledgement guards alone do not prevent a stale in-flight worker from resetting a retained primary's approval. Review both normal audit runs and automatic refresh/review paths, then test the race against group confirmation.
- Execute migrations 13/14 with positive, negative, rollback, ordering and permission tests on disposable PostgreSQL, and verify live-schema compatibility before any live application.
- Verify editor/import/media/reference/pricing paths against the database guards; add explicit audited duplicate reversal and read-only resolution history. Ordinary writes remain unable to reverse duplicates until that reviewed mechanism exists.
- Type-check/build the frontend and exercise rendered mixed review, comparisons, outside scope, navigation, stale evidence, timeout/reload/retry and receipts.
- Run complete project, HTTP authorization and worker-race regressions. Drain old workers during a separately reviewed rollout.
- Apply migrations, deploy and make live product decisions only under separate exact-action approvals.

## Source-contract check
node --test backend/test/catalogue-duplicate-protection-contract.test.js
