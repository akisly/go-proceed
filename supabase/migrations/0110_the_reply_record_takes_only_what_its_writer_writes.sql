-- 0110: idempotency_records takes at INSERT only the columns its writer writes.
--
-- Append-only; narrows one grant. No row changes, no policy changes.
--
-- 0003 granted goproceed_app SELECT and INSERT on public.idempotency_records
-- whole. Its one product writer, withIdempotency (packages/database/src/
-- idempotency.ts), inserts eleven columns once per command and never updates:
--   organization_id, actor_scope, operation_id, idempotency_key, request_hash,
--   state, response_status, response_body, response_headers, expires_at,
--   completed_at.
-- `id` and `created_at` take their defaults. A column grant keeps an
-- arbitrary-SQL session from choosing a record's id or its created_at, so
-- created_at is always the insert's time. expires_at, which the purge reads,
-- stays the writer's: it is computed from the retention class on the server,
-- and a ceiling on it is BL-202 (DEV-086 gp-security S1). goproceed_service
-- inherits goproceed_app (0034) and is narrowed with it. The expiry
-- definers (0007) delete as their owner, unaffected.
--
-- DEV-086 (BL-172) found it while writing the cross-workspace write tests the
-- DEV-076 minimum asks; the owner chose it on 2026-09-25 («Narrow in 0110»).
-- It is not needed for the minimum: idem_insert confines the row by its
-- actor and its workspace membership.
--
-- Rollback:
--   grant insert on public.idempotency_records to goproceed_app;
-- and, in the same change, the idempotency_records row of
-- technical/database/rls-write-coverage.csv, DA-134, and the privilege probe of
-- packages/testing/src/operational-write-rls.test.ts.

set local lock_timeout = '5s';

revoke insert on public.idempotency_records from goproceed_app;
grant insert (organization_id, actor_scope, operation_id, idempotency_key, request_hash,
              state, response_status, response_body, response_headers, expires_at,
              completed_at)
  on public.idempotency_records to goproceed_app;

do $$
declare
  role_name text;
begin
  for role_name in select rolname from pg_catalog.pg_roles where rolname like 'goproceed\_%' loop
    if pg_catalog.has_table_privilege(role_name, 'public.idempotency_records', 'INSERT')
       or pg_catalog.has_column_privilege(role_name, 'public.idempotency_records', 'id', 'INSERT')
       or pg_catalog.has_column_privilege(role_name, 'public.idempotency_records', 'created_at', 'INSERT') then
      raise exception '0110: % may still insert a whole record, its id or its created_at', role_name;
    end if;
  end loop;
  if not pg_catalog.has_column_privilege('goproceed_app', 'public.idempotency_records', 'completed_at', 'INSERT')
     or not pg_catalog.has_column_privilege('goproceed_app', 'public.idempotency_records', 'organization_id', 'INSERT')
     or not pg_catalog.has_column_privilege('goproceed_service', 'public.idempotency_records', 'actor_scope', 'INSERT') then
    raise exception '0110: a column the writer writes was withdrawn';
  end if;
end
$$;
