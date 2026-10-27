# Version-3 workbook validation increment

The new Catalogue New workbook / master workspace downloads create/update templates and an assigned-product master, validates supplied workbooks and matches local-folder image paths. Endpoints are under /api/admin/catalogue/taxonomy/imports-v2/v3. Existing v2 import routes and semantics remain unchanged.

Row 1 enumerates current active reference codes; row 2 contains stable headers; data starts at row 3. tag:group-code namespaces tag columns to avoid collisions with product fields. Product SKU/name are absent from create input. Update requires SKU and exported expected_revision, uses no upsert, and rejects stale or unknown identifiers. Existing name/image IDs are informational only; new local image paths are separate. Blank update cells preserve existing values. Nonblank tag cells replace only that group; there is not yet an explicit clearing operation.

Comma lists support quoted comma-containing values and doubled quotes. Image paths normalize Windows separators, require explicit root mapping for absolute paths, and reject traversal. Local matching is exact and case-sensitive. Client MIME/size matching does not establish server-side content validity. No image bytes are transferred in this increment. Each row supports up to 20 image paths.

Group selection_mode is read from reference records when present; existing schema defaults to multi. The actual policy column, master UI and shared manual-write cardinality enforcement still need implementation. All groups remain optional for drafts.

Twelve list/path/revision helper tests passed locally. XLSX roundtrip/header parsing, full row-normalization, database master snapshot, HTTP integration, UI type-check, build and browser tests have not been executed. Master export currently refuses catalogues above 1000 assigned tag-model products rather than silently truncating; scoped/paged export remains pending.

This is NOT the full rollout. commit_ready is always false and the v3 commit route refuses writes. Still required: authenticated expiring server preview jobs, immutable file manifests, image signature checks/staging and storage cleanup, batch digest/idempotency/recovery, exact-preview transactional product/media commit, rule-master UI and naming integration, remaining nullable-client/general-editor work, integrated tests and separately approved schema activation. No migrations are applied and no production products are changed by this commit.
