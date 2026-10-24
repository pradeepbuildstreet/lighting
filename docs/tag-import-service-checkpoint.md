# Excel v2 service/router checkpoint

Routes: /api/admin/catalogue/taxonomy/imports-v2/state, /template, POST /upload, GET /:id and POST /:id/commit. They inherit admin session/origin enforcement and add an admin-context check. The template is blank except headers, metadata and instructions; no example product is automatically imported. No complete vocabulary download is required.

Preview/commit require taxonomy version 3, not installed. State reports disabled until coordinated activation. Existing legacy import routes and customer/wishlist code are unchanged. No SQL migration is included.

The service batches relevant reference lookup and staging writes, stores format/fingerprint metadata in an existing import-row sidecar, retains ProductTags errors, validates ownership/tokens/expiry/replacement confirmation, reloads references at commit, uses one shared writer transaction, and returns recorded results on replay without resaving products. Existing product revisions are checked by the shared writer. No automatic audit, approval or publication occurs. The future upload UI must use the v2 routes/template and show tag-mode semantics clearly.

Validation: 17 mocked controller/reference-query protocol tests and syntax checks. Workbook/parser and writer are injected doubles in these tests. Real PostgreSQL query execution/transactions, Express/multer/auth forwarding, generated XLSX binary, full parser/writer integration, concurrency, frontend build and live performance remain unverified. Reference limits are operational guards, not limits on reference-data creation.
