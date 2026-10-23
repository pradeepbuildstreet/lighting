# Batch 3: frontend request-flow performance

Baseline release: 9bb35dc3cdb51fc04e053c8c9eb43feb133b886d (Batch 2).

Only overlapping browser category requests share one in-flight load. Completed results and failures are not cached. Each subscriber has independent cancellation; the last cancellation aborts the underlying load. Server requests are not shared across visitors. Existing public category pruning and no-store API requests remain in place. Product/media authorization and publication checks are unchanged.

The listing starts category and facet reads together. Product loading waits for category validation, not facets. Optional brand/currency filters render under a server Suspense boundary, with a loading message while pending and the existing unavailable-options behaviour on failure. Current selections and Batch 2 browsing context are retained. Streaming may improve first content without reducing full response-body duration.

Run on the same machine/network before and after deployment:

    node scripts/measure-catalogue.cjs https://www.luminoza.in > performance.json

The probe makes nine sequential public GET requests and logs status, content type, response-header time, total body time and bytes. It sends no credentials and follows no redirects. This does not measure browser LCP/INP or database execution time. Use browser Network/Performance tools to check product rendering, optional-filter loading, and overlapping category requests. Check normal, slow and failed-filter responses, plus cancellation and route changes.

Verified during preparation: 13 isolated loader/orchestration and mocked probe tests passed. Not verified: production Next.js build, React streaming/browser behaviour, Hostinger deployment or live performance. No speed percentage is claimed. No backend, SQL, media-root, header-layout or main-branch changes are included. Revert only this batch commit if rollback is required, retaining Batch 2.
