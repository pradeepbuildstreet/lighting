# Category navigation combined release

Status: backend policy batch only; not ready for production deployment.

Apply database/supabase/migrations/03_category_direct_products.sql before the new API. This additive migration retains schema_versions=3 because existing readiness contracts require it. Existing categories default to allow_direct_products=true; no assignments are removed. Review and back up the database before applying. The migration has not been executed against Supabase in this development environment.

Category writes accept a strict boolean allow_direct_products. Omitted flags on updates preserve the existing value. Disabling is rejected until directly assigned products are moved. Shared writeProduct validates assignments before product locks/writes, covering manual saves and Excel import commits. Import preview integration remains to be completed. Database triggers enforce the policy for direct SQL writes. Write paths coordinate on the existing category advisory lock; validate concurrent writes in PostgreSQL before rollout.

Verified: 18 isolated policy unit tests passed. Not yet verified: full backend integration, PostgreSQL triggers/concurrency, frontend build/browser tests or live performance.

Remaining implementation: admin nesting and selection UI; import preview validation; empty storefront category pruning; wrapping navigation; validated browsing-context breadcrumbs; measured request/query optimizations and publication-safe caching where appropriate.

Keep all batches on feature/category-navigation-stages. Do not deploy this partial batch. Complete integration checks before final approved release merge; synchronize main after production-compatible integration. Do not change MEDIA_STORAGE_ROOT, credentials or the separate SEO-service availability contract.
