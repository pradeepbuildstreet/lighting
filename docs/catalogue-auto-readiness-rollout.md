# Automatic readiness rollout — incomplete, not deployed

The base migration is backend/db/catalogue-auto-readiness.sql. It must not be applied alone: its original product-trigger guard skips an unchanged-price update after the operational API temporarily withdraws publication.

Required companion: backend/db/catalogue-auto-readiness-noop-fix.sql. Apply the base and companion in one migration transaction, with lock and statement timeouts, before accepting writes against the new schema. The companion reassesses publication-disabled products and skips otherwise unchanged updates ending with publication enabled to prevent publication recursion. It never changes activation or grants distinct approval.

Production preflight and row-state capture on 2026-11-05 observed 21 products, 17 published, 16 active and 16 visible. No currently visible product failed the proposed current dealer-price condition. This is not a full readiness prediction or a complete database backup. Captured product states, visible IDs, original dealer functions, public-view definition and grants must remain available for guarded rollback. Do not overwrite later catalogue edits from a baseline.

Verification: a mocked application model reproduced the unchanged-price bug; six logical tests of the corrective trigger guard passed. These are not PostgreSQL integration tests. Validate actual trigger execution, no-op and changed-price saves, eligibility holds, activation preservation, conflict isolation, and current returned edit tokens before claiming rollout success.

Remaining delivery gaps: frontend compilation/browser verification; commit and integration of the admin candidate; durable automatic execution of missing/stale duplicate audits; production migration execution and post-install verification. Duplicate review remains explicit and required. The full pipeline must not be described as complete on the strength of this corrective source commit.
