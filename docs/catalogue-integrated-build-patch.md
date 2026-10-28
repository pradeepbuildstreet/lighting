# Integrated catalogue build correction

Scope: acc6c643 (v3 workbook/master validation), b56897d9 (server jobs/staging), 4cef3a6c (lifecycle UI/rulebook), a4bb4100 (product editor). These features are already cumulative in release; do not reapply the feature commits or squash unrelated history.

The confirmed compile failure originated earlier in dff261aa: NewCatalogueProduct normalized a Record<string,any> spread without an explicit result type. The patch retains the narrow const next:Row correction. It was already committed separately as af56e6ee; on that release head this source hunk must be skipped, not reapplied.

The new regression test extracts the actual next declaration from the TSX source, compiles its property accesses with the installed TypeScript compiler, includes the original failing TS2339 shape as a negative control, and verifies normalization preserves selling price and draft content in both modes. It runs within the existing frontend tests glob after npm ci.

A local integrated runner is available with node scripts/verify-catalogue-integration.cjs after installing locked backend and frontend dependencies. Supply the same build environment as the existing workflow (INTERNAL_API_ORIGIN, SITE_URL, NEXT_PUBLIC_SITE_URL and LOCAL_BUILD for a loopback-only verification build). It runs all five checks even if an earlier check fails and records separate logs plus summary.json under artifacts/catalogue-integration. Do not commit those generated logs. A loopback LOCAL_BUILD verifies compilation, not production host configuration.

The existing backend/frontend CI jobs, permissions, caching, event triggers and log retention remain unchanged. A final integrated result requires both jobs to succeed without repeating the expensive suites. Deployment protection must be configured to respect the checks; this patch does not change hosting settings or branch protection.

No migration, SKU allocation, product/media write, cleanup action, activation flag, feature reimplementation or database deployment is included. Four failed cumulative builds do not establish four separate compiler defects. Further errors must be reported by the full checks, not guessed or suppressed.

Prepared verification: source blobs matched GitHub SHA values, Node syntax checks passed, and git apply checks passed on reconstructed source snapshots. TypeScript regression execution, full tests, tsc, Next.js build, CI status and browser/database integration remain unverified in the preparation environment because project dependencies and the TypeScript compiler are not installed there.
