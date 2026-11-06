# Catalogue group review - release integration

## Production database status
On 2026-11-06, Supabase luminoza (baouokuhgbwltuwsvoji) successfully applied catalogue_group_review_and_terminal_protection, registered as version 20261106150248. The user explicitly waived a new backup. The combined approved transaction installed the schema logic from corrected migration 13 and migration 14 together, with additional production preflight, NOWAIT table locks and pre-commit preservation checks.

Those checks passed: existing product revisions, review status, duplicate links, publication/activation state and approval-function results were unchanged; product/audit/review counts were unchanged; no group decisions were created. This establishes installation and that preservation check at commit, not functional group-save, permission, concurrency or rendered-UI verification.

Do not replay numbered scripts 13/14 on this production instance: their objects are already installed through the combined migration. The files remain schema-source definitions for new environments. The combined production transaction's exact SQL is recorded in Supabase migration history; this source update synchronizes the approval safeguard, not the complete preflight wrapper.

## Algorithm safeguard synchronization
Migration 13 now preserves the pre-existing production condition requiring tags-evidence-v2 audits for products with product_attributes or product_tags. That common condition applies before either approve_distinct or retain_primary is accepted. Retained-primary approval additionally binds the exact group item, audit, review, revision, reviewer, corpus digest and algorithm and requires at least one recorded duplicate target. The earlier production transaction already contained this correction; this commit does not modify the database again.

## Current implementation
Group UI/API supports explicit mixed decisions, direct retained targets, comparison acknowledgements, notes, outside-candidate blocking, freshness checks, atomic recording and exact-request retry recovery. Retained activation is preserved; duplicates are disabled/unpublished. Application publication validates retained-primary evidence without weakening other gates. Worker initial runs, bounded refreshes and automatic approvals supply immutable claimed leases to transaction-level guards. Claim/post-claim checks exclude duplicate status and links while permitting legitimate inactive products. Database terminal guards and automatic reassessment support are installed.

Repository source is not proof that the web application or worker processes are running that version. Frontend TypeScript/build/browser verification, end-to-end group saves, real permissions and worker races remain pending. Explicit audited reversal and read-only resolution-history functionality are not yet implemented.

## Verification record
Preparation previously exercised isolated policy, audit, publication, worker and UI-helper cases with the limitations documented in their commits. This synchronization passed 15 migration source-contract checks, including the new common algorithm-gate regression. Source-text checks are not runtime trigger tests. The production installation did not exercise synthetic group fixtures or concurrent workers, and no application deployment was performed as part of the database migration.

## Remaining work
- Verify production objects/permissions and installed definitions using a separately approved read-only postflight; do not infer runtime grants from successful DDL alone.
- Prepare separately approved rollback-only synthetic database cases for all-distinct groups, multiple clusters, stale revisions, incomplete groups, bad targets, unauthorized actors and terminal duplicate writes. Do not use real product decisions as test fixtures.
- Verify application/worker deployment, run complete regression suites and real two-worker/group-confirmation races, including expiry during lock waits and lost acknowledgements.
- Type-check/build the frontend and test rendered group review, outside scope, dirty navigation, stale previews, timeout/reload/retry and receipts.
- Implement explicit audited reversal and read-only resolution history while preserving original decisions.
- Review and approve any further source writes, production fixes, deployments or live group decisions individually.

## Focused schema-source check
node --test backend/test/catalogue-group-review-schema-contract.test.js
