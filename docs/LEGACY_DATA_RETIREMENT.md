# Data retirement gate

Run npm run retirement:preflight from backend after installation, or the release preflight before installation. Reports are aggregate-only: do not post passwords, hashes, tokens or connection strings.

Missing catalogue UUIDs block removal of SKU compatibility, not this release installation: this release keeps those fallback paths. Missing live products can be legitimate historical snapshot references and must be reviewed. Legacy media paths require separate reference/PDF checks. Plausible bcrypt shape is not proof of login.

No automatic remapping, deletion, schema migration or account recreation is supplied. Any later data cleanup needs a reviewed, backed-up operation. Re-run the live report immediately before a future strict UUID-only cutover.
