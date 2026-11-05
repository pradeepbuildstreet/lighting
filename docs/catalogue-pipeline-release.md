# Coordinated catalogue pipeline candidate

Base release revision: 0e96aa6f64b2facd627968b961d767e75c0c324a.
One final source commit is intended to trigger Hostinger builds. No build/deployment is claimed by preparing these files.

Production rollout order:
1. Deploy this source with the database worker disabled (default).
2. In one separately approved database transaction, apply catalogue-auto-readiness.sql, catalogue-auto-readiness-noop-fix.sql, then catalogue-background-audits.sql. Use bounded lock/statement timeouts. Keep recorded rollback definitions and product-state baseline available.
3. Verify installed objects, grants, unchanged activation flags and expected visibility before enabling the worker. No historical backfill is automatic.
4. Separately approve enabling catalogue_pipeline_configuration.enabled. Pending jobs without an originating administrator are held until an active admin rechecks the product.

The queue is populated from the existing readiness assessment, not from a competing validation engine. Missing/stale audit evidence queues matching; current completed audits are reused, and human distinct approval is never automated. Original scoring's synchronous 1,000-product corpus limit is retained and surfaced as a hold. Lease ownership and generation predicates prevent stale workers clearing newer jobs. Failed leases and retries are bounded. Actor eligibility is rechecked by the existing audit service.

The matrix classifies the central assessment's explanations for display/filtering. It does not authorize publication or activation. Unassessed records are not marked passed. Bulk actions use existing guarded APIs independently, select only the current page (maximum 50), and retain failed/unconfirmed results. Dealer quote concurrency semantics are inherited from the existing quote endpoint and still need integration verification.

Verification performed in preparation: eight mocked worker tests passed; backend syntax checks passed. New TSX compilation, PostgreSQL migration/runtime tests, full regression suite, production installation and Hostinger deployment verification are pending. The earlier user-reported successful build predates the new interface file.
