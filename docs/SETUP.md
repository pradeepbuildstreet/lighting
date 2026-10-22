# Supported consolidated application setup

Use DATABASE_URL as the ONLY database connection setting with this release. No DATABASE_URL fallback. One shared pool per backend process covers auth, catalogue, wishlist/enquiry and offers. Keep real admin accounts, UUIDs, password hashes, AUTH_SECRET and bridge token unchanged.

This is an upgrade over the supplied Phase-1-applied source, not a new-database initializer. Never apply historical recreation SQL or create-admin just to upgrade. The installer does not mutate database, media or environment files.

## Development validation
Use the final release README for guarded installation/rollback. In a development copy run backend npm ci, npm test, npm run retirement:preflight; frontend npm run build with your validated local settings. Live login, saved/new enquiry/offer and customer media/PDF still require checks.

## Account provisioning
scripts/create-admin.js remains an explicit provisioning tool; use existing accounts for upgrades. Existing admin API/login behavior is preserved.

## Historical tools
See docs/historical/tools. Old repair, redundant provisioning and one-time identity mapping utilities are now reference documents, not executable setup steps. Historical migrations/recreation SQL and release manifests remain evidence, not a verified fresh-install migration chain.

## Compatibility
Old browser URL transitions and historical SKU/link/image handling remain intentional. Retiring a source module is not approval to delete its records. Dependency cleanup removes Supabase JS client, not a PostgreSQL provider or database.
