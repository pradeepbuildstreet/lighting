# Group resolution history

Source implementation adds authorized GET /api/admin/catalogue/products/:id/duplicate-history and GET /api/admin/catalogue/duplicates/groups/:id/history. Reads revalidate the administrator and use a repeatable-read transaction. Product history uses 50-record keyset pages; detail includes all original members, reviewed snapshots and linked audit/review fields. No group snapshot is rewritten, no grants change and no migration is required.

Admin UI: /admin/catalogue/resolutions, linked separately from catalogue to avoid abandoning an in-progress review. Current product state is labelled separately from historical decisions.

Reversal and reversal-event history are still unavailable and explicitly labelled as such. Individual-only reviews are outside this group-history screen.

Added backend mocked regressions are discovered by the release test runner. They are not PostgreSQL integration tests. CI results, TypeScript/build, authenticated HTTP behaviour and rendered-browser checks must be observed before marking verification complete. Source installation is not application deployment.
