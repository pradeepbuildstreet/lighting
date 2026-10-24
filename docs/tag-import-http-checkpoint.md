# Excel v2 multipart/XLSX integration test checkpoint

Base: release 5f8e206db166526179c6a95dc231bebd0c77b198. CI results for that commit are still unverified; no passing build or production acceptance is claimed.

The import router accepts an optional construction-time importService dependency for integration testing. Existing production callers provide none and retain the existing service/writer construction. This option cannot be selected by an HTTP request. No route, authentication middleware, limits, template, parser, schema or activation behaviour is otherwise changed.

Twelve new tests connect real Express, multer multipart handling, generated ExcelJS binaries, ZIP/workbook parsing, reference resolution, actual preview/commit service logic, and core normalisation. They cover template decoding, tagged-price preview, commit/replay, invalid tag references, reference drift, explicit replacement confirmation, writer failure, owner isolation, disabled activation, missing admin, filename checks and the 5 MiB file limit. Dependencies are mandatory: missing Express/multer/ExcelJS fails test loading rather than skipping these cases. The existing full backend CI runner discovers the new test automatically.

Storage/reference queries and the product writer transaction are test doubles. Reference lookup is injected; PostgreSQL is not queried. Mock rollback tests are not PostgreSQL rollback or real concurrency tests. The admin context header exists only in the fixture; actual session/origin authentication and browser upload handling are not tested.

Local validation: JavaScript syntax checks only. Runtime HTTP/XLSX tests require installed backend dependencies and have not run in this sandbox. They must be evaluated in CI before claiming they pass. The previously added verification workflow remains unchanged. Full editor/build acceptance, upload UI, production SQL validation/application, review evidence UI and coordinated activation remain pending. No main, live data, runtime frontend, SQL, media, wishlist or compatibility changes are included.
