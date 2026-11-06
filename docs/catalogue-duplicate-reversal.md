# Audited duplicate reversal

Migration 15 remains source only until separately approved and installed; never replay production migrations 13/14. No product backfill or real reversal has been performed in this implementation sequence.

POST /api/admin/catalogue/products/:id/duplicate-reversal binds expected_revision, expected_review_id, expected_group_resolution_id (explicit null for individual-only reviews), expected_target_product_id, request_key and reason to the active administrator. Repeat uncertain requests identically. The database function appends immutable original-evidence and before/after snapshots, consumes a private transaction-bound authorization, and keeps ordinary reopening/retargeting blocked.

The reopened product receives a new revision, stays inactive/unpublished, loses approval, and has its worker generation invalidated and job held for fresh review. A still-current retained-primary approval from the exact same group is invalidated with a new revision and held job while preserving primary activation. Newer unrelated approvals are not intentionally replaced. Incoming duplicate links must be reversed individually rather than silently moved.

The admin history workspace now supplies fresh reversal inspection, explicit confirmation, exact-request recovery and subsequent event pages. GET product reversal history and GET /api/admin/catalogue/duplicates/groups/:id/reversals support 50-event keyset pages. Missing prerequisites disable reversal. UI source is not a deployed or browser-verified workflow.

The synthetic rollback packet remains unexecuted and covers only its documented individual-reversal cases. Required remaining database coverage includes group primary invalidation, all-distinct and mixed clusters, stale audit/review identities, unauthorized actors, deferred group constraints, identity edits and job guards. Complete worker races, full CI/type-check/Next build, rendered browser tests, migration installation, draining old workers, deployment/version checks and operational postflight remain pending.
