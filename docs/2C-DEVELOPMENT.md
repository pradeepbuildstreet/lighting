# 2C integrated importer development snapshot — NOT the full release candidate

This archive preserves a cumulative source tree based on the supplied folder-preserving
2C source baseline. All importer modules, route wiring, UI and tests are included together.
Do not overlay it on your working project; the guarded release installer is not included.

Implemented source path:
POST /api/admin/catalogue/imports/upload (multipart file + mode)
GET /api/admin/catalogue/imports/:id
POST /api/admin/catalogue/imports/:id/commit (preview_revision, confirm_replacement)
Parent catalogue authentication and Origin validation precede import routes.
Import2C is rendered in CatalogueManager using existing CSS classes.

Default mode: create. update/upsert explicit. Updates replace full imported base/spec fields
and category assignments. Existing media/socket groups/SEO/dealer prices are not imported.
The existing writer handles mode guards, active references, revision checking and draft reset.
Preview persists original workbook digest, source sheet/row, staged payload and errors.
Commit locks the job, validates owner/token/expiry, and applies product writes inside db.transaction.
Repeat commits of the same successful job return recorded results.

Validation this run: 58 selected tests passed (46 baseline + 12 importer tests).
Changed JavaScript syntax and relative module imports checked.
NOT tested: real ExcelJS decoding, real PostgreSQL transaction/rollback/concurrency,
Express/multer HTTP integration, TypeScript check/Next build, browser behaviour.
ZIP limits are based on declared central-directory sizes; independent decompression bounds,
malware scanning, process-level upload concurrency limiting are not implemented.
Full-release work still pending: duplicate review, publication controls, agreed UI refinements,
2C installer/migration planning and complete integration verification.

Tests from project root:
node --test backend/test/catalogue-imports.test.js backend/test/catalogue-validator.test.js backend/test/catalogue-2b.test.js

This development snapshot is not production certified and is not an installation deliverable.
