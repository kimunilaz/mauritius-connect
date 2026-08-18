# Schema snapshots

Ordered files in `../migrations/` are the schema source of truth. This directory
is reserved for a schema dump generated from a verified Supabase/PostgreSQL
environment when one is needed. Do not maintain a second hand-written SQL schema
here. Document the exact dump command and source migration version with any
future generated snapshot.
