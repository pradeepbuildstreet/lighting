# Tag publication schema prerequisite — prepared, not applied

Reviewed base: release 492733f776cd0159c021419d25a5763a571456da.
SQL location: database/supabase/pending/tag-product-publication-prerequisite.sql.
This is pending SQL, not an applied migration and not activation. Do not install taxonomy version 3 as part of this checkpoint.

The SQL introduces catalogue_product_model_ready(uuid,text), shared by check_publish and public_products. Tag-model products require activation version 3, matching active reference kinds, valid minimal profile attributes, active assigned tags/groups, an active primary category hierarchy, and direct-product eligibility for all assigned categories. Dimensions/wattage are optional but bounded positive values; lumens may be zero. Legacy fixture/light specifications remain supported for products with no tag-model rows.

The product-kind restriction becomes a bounded code constraint plus a reference-validation trigger. Existing fixture/light codes remain accepted; other codes must resolve to an active product kind when inserted or changed. No products are converted or deleted.

current_duplicate_approval keeps subject-revision-based completed-approval stability and latest audit/reviewer requirements; tag-model products additionally require tags-evidence-v2. It does not introduce permanent global corpus revalidation. Existing guard_tag_model_publication remains installed. Existing RLS, media/revision triggers, view grants/options, compatibility, wishlist and core schema_versions are not intentionally changed. New helper functions grant execution only to service_role, not browser roles.

Validation: 15 passing Node SQL-text contract tests. These inspect the proposed text only. No PostgreSQL parser was available in the sandbox. The SQL has NOT been parsed or executed by PostgreSQL, and no migration/rollback/concurrency/performance or live integration test has run. These tests do not prove database correctness.

Before application: review the live schema for drift, validate on a representative non-production database, and verify function signatures/view options/grants and legacy publication regressions. Apply only after separate approval through Supabase apply_migration. Lock and statement timeouts fail rather than wait indefinitely. CREATE FUNCTION/TRIGGER makes this a one-time prerequisite, not a rerunnable script. It deliberately rejects already-activated databases.

Still pending: application publication/readiness and visibility adaptation, manual writer/editor cutover, upload/review UI integration, a complete save-audit-review-publish test, and coordinated activation. Public catalogue consumers must be checked for assumptions that every non-fixture is a legacy light before activation. The compatibility decision remains open; no technical compatibility model is removed here. Rollback must be reviewed against any new-kind data created later; do not blindly restore the old kind constraint after activation.
