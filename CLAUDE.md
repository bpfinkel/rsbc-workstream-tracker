# RSBC Committee Member Portal

## Supabase

Project `RSBC-APP`, ref `lvrvyenryewfrwcojjje`.

### How the app reaches Supabase

- **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): Auth only. `lib/supabase/client.js`,
  `lib/supabase/server.js` and `middleware.js` use it to sign in and read the session.
  The app never queries a table with it.
- **authenticated role**: never used for table access. Signed-in members do not query
  tables directly; every read and write goes through an API route.
- **service_role key** (`SUPABASE_SERVICE_ROLE_KEY`): all table access.
  `lib/supabase/admin.js` (`getSupabaseAdmin()`) in API routes, plus the direct
  `/rest/v1/activity_log` insert in `middleware.js`. Server-side only; never import it
  into client code.
- Every table has RLS enabled with **zero policies by design**. Access rules (admin-only,
  own-rows-only) are enforced in the API routes, not in Postgres.

### Migrations

There is no `supabase/` folder in this repo. Migrations are applied directly to the
project with the Supabase MCP `apply_migration` tool and live only in the project's
migration history (`list_migrations`). Name them `create_<table>` and so on.

### New tables need explicit GRANTs (Supabase change, effective October 30, 2026)

From October 30, 2026, Supabase no longer grants Data API (PostgREST / supabase-js /
GraphQL) access to new tables in `public`. A table created without GRANTs returns
"permission denied" even to the service-role client. This also applies to recreated
schemas, preview branches and a local `supabase db reset`.

Every migration that creates a table in `public` must, in the same migration:

1. Enable RLS.
2. Revoke everything from `anon` and `authenticated`.
3. Grant `service_role` only the privileges the app actually uses.

```sql
create table public.<table> (
  ...
);

alter table public.<table> enable row level security;

revoke all on table public.<table> from anon, authenticated;
grant select, insert, update, delete on table public.<table> to service_role;
-- Trim the service_role list to what the API routes need
-- (activity_log, for example, gets select, insert, delete only).
-- If the table uses a serial/identity column that the app inserts through,
-- identity columns need nothing more; a plain sequence also needs:
-- grant usage, select on sequence public.<table>_id_seq to service_role;
```

Do **not** grant anything to `anon` or `authenticated` unless Bryan explicitly decides a
table should be read from the browser; if that happens, add RLS policies in the same
migration, and never give `anon` write access.

After applying, verify with:

```sql
select grantee, string_agg(privilege_type, ',') from information_schema.role_table_grants
where table_schema = 'public' and table_name = '<table>' group by grantee;
```

### Existing tables: leave alone

`activity_log`, `interview_notes`, `members` and `tasks` were verified working through
the Data API on October 20, 2026. Do not change their grants or RLS. (`members` and
`tasks` predate the explicit-grant pattern and still carry Supabase's default grants to
`anon`/`authenticated`; RLS with no policies blocks those roles. That is known and
intentional for now.)
