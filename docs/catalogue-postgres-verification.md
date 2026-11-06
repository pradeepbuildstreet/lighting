# PostgreSQL lease verification

The dedicated Catalogue PostgreSQL lease verification workflow installs locked backend dependencies and starts a disposable PostgreSQL 17 service. It invokes the actual assertWorkerLease implementation with independent connections, substituting only a uniquely named test job table. It tests owned leases, wrong generation/token, pre-expired leases, expiry while an unchanged row is locked, and generation invalidation by the lock owner. The suite creates and drops only its isolated fixture schema. It refuses non-loopback database URLs and requires CATALOGUE_TEST_DATABASE_DISPOSABLE=1. It never uses production credentials.

The lease query now materializes the row-locking subquery and checks clock_timestamp again on its locked output, addressing expiry while waiting for FOR UPDATE. Existing actor/revision/generation/token checks and product-before-job caller ordering are unchanged.

This is a real PostgreSQL test of the lease primitive when the workflow actually runs. It is NOT a test of the production schema, whole-worker concurrency, group confirmation races, audited reversal triggers, or browser behaviour. Do not report it as passed until the workflow result and retained log have been inspected.

Required independent gates remain: the existing backend/frontend TypeScript/Next build workflow, this PostgreSQL workflow, complete synthetic group/reversal functional cases, whole-worker concurrent processes, rendered admin tests, and coordinated rollout. Migration 15 remains source-only until separately approved. No connected Actions-log reader or SSH/terminal runner has been established. Source commits do not establish deployed versions.
