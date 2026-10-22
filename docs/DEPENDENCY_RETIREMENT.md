# Dependency retirement

Removed @supabase/supabase-js and unreachable lock nodes:

- node_modules/@supabase/auth-js
- node_modules/@supabase/functions-js
- node_modules/@supabase/phoenix
- node_modules/@supabase/postgrest-js
- node_modules/@supabase/realtime-js
- node_modules/@supabase/storage-js
- node_modules/@supabase/supabase-js
- node_modules/iceberg-js

Retained package records, versions and integrities are unchanged, including shared tslib. pg-native remains an already-absent optional peer. npm ci/npm audit/network downloads must be verified locally; they were not run here.
