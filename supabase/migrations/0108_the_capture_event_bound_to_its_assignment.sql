-- 0108: a capture event is bound to its assignment, and both evidence tables
-- take at INSERT, from the goproceed principals, only the columns their
-- writers write (service_role keeps Supabase's defaults, 0009).
--
-- Append-only; adds one foreign key and narrows two grants. No row changes.
--
-- 1. capture_events.work_assignment_id had no foreign key and no policy term
--    (BL-105): a member of A, or the service declaring A, could write B's
--    assignment id into A's own capture event, and nothing refused it. The
--    event now names an assignment of its own workspace and project, through
--    the key upload_intents already uses. MATCH SIMPLE, so an event with no
--    assignment (a device event with no intent, 0035) stays admissible.
--    The preflight refuses to add it over a row that already breaks it.
--
-- 2. The INSERT grants. 0016 granted INSERT on both tables whole. The writers
--    (apps/app/src/lib/evidence/authorize-upload-intent.ts and
--    finalize-upload-intent.ts, which the Telegram path shares) write eleven
--    columns of capture_events and twenty-two of upload_intents. The rest let a
--    member-plane INSERT:
--      - backdate a provenance fact (capture_events.reported_at, whose default
--        is the server's receipt time) or choose its id;
--      - create an intent already past the state machine — `available`,
--        `scan_blocked`, claimed or purged, with a finalized evidence object,
--        or with a purged_at that takes its reservation out of
--        app.evidence_bytes_in_use (0031) — which 0031 made the server's.
--    goproceed_service inherits these grants (BL-019) and writes the same
--    columns. SECURITY DEFINER functions write as their owner, unaffected.
--    The columns kept are still unconstrained in value: an intent's
--    quota_reserved_bytes, staging_bucket, staging_storage_key and expires_at
--    are whatever the INSERT says (BL-197).
--
-- Hosted apply: the foreign key takes SHARE ROW EXCLUSIVE on both tables while
-- it validates; wait no longer than this for them.
set local lock_timeout = '5s';
--
-- DEV-084 (BL-170) found both while writing the cross-workspace write-denial
-- tests the DEV-076 minimum asks of every covered row that holds a write. The
-- owner chose the foreign key and the narrowing on 2026-09-25 (DEV-084).
--
-- Rollback:
--   alter table public.capture_events drop constraint capture_events_assignment_fkey;
--   revoke insert on public.capture_events, public.upload_intents from goproceed_app;
--   grant insert on public.capture_events, public.upload_intents to goproceed_app;
-- and, in the same change, the three evidence rows of
-- technical/database/rls-write-coverage.csv (their privileges return to INSERT),
-- DA-113, DA-182 and DA-183, INV-001 and INV-060's DEV-084 clause, the
-- capture_events → work_assignments row of
-- technical/database/relationship-catalog.csv, BL-105's state, and the
-- assignment and column probes of packages/testing/src/evidence-write-rls.test.ts.

do $$
declare
  broken bigint;
begin
  select count(*) into broken
    from public.capture_events c
   where c.work_assignment_id is not null
     and not exists (select 1 from public.work_assignments w
                      where w.workspace_id = c.workspace_id
                        and w.project_id = c.project_id
                        and w.id = c.work_assignment_id);
  if broken > 0 then
    raise exception '0108: % capture event(s) name an assignment outside their own workspace and project', broken;
  end if;
end
$$;

alter table public.capture_events
  add constraint capture_events_assignment_fkey
  foreign key (workspace_id, project_id, work_assignment_id)
  references public.work_assignments (workspace_id, project_id, id);

revoke insert on public.capture_events from goproceed_app;
grant insert (workspace_id, project_id, work_assignment_id, upload_intent_id,
              device_capture_id, client_state, event_source, claimed_capture_time,
              claimed_tz_offset, capture_time_trust, failure_code)
  on public.capture_events to goproceed_app;

revoke insert on public.upload_intents from goproceed_app;
grant insert (id, workspace_id, project_id, work_assignment_id, created_by_member_id,
              device_capture_id, origin_method, original_filename, claimed_capture_time,
              claimed_tz_offset, source_app_version, idempotency_key, request_hash,
              expected_byte_size, expected_content_hash, allowed_content_family,
              claimed_media_type, staging_bucket, staging_storage_key, expires_at,
              quota_reserved_bytes, requirement_occurrence_id)
  on public.upload_intents to goproceed_app;

do $$
declare
  role_name text;
  c text;
begin
  for role_name in select rolname from pg_roles where rolname like 'goproceed\_%' loop
    if has_table_privilege(role_name, 'public.capture_events', 'INSERT')
       or has_table_privilege(role_name, 'public.upload_intents', 'INSERT') then
      raise exception '0108: % still holds a whole-table INSERT on an evidence table', role_name;
    end if;
    foreach c in array array['id', 'reported_at'] loop
      if has_column_privilege(role_name, 'public.capture_events', c, 'INSERT') then
        raise exception '0108: % may still write capture_events.%', role_name, c;
      end if;
    end loop;
    foreach c in array array['status', 'finalized_evidence_object_id', 'failure_code', 'version',
                             'created_at', 'staging_attempt', 'blocked_at', 'purge_claimed_at',
                             'purge_claim_token', 'purge_attempts', 'purged_at', 'purge_failure'] loop
      if has_column_privilege(role_name, 'public.upload_intents', c, 'INSERT') then
        raise exception '0108: % may still write upload_intents.%', role_name, c;
      end if;
    end loop;
  end loop;
  if not has_column_privilege('goproceed_app', 'public.capture_events', 'failure_code', 'INSERT')
     or not has_column_privilege('goproceed_app', 'public.upload_intents', 'requirement_occurrence_id', 'INSERT')
     or not has_table_privilege('goproceed_app', 'public.upload_intents', 'SELECT') then
    raise exception '0108: a grant the product uses was withdrawn';
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.capture_events'::regclass
                    and conname = 'capture_events_assignment_fkey' and contype = 'f') then
    raise exception '0108: the capture event is not bound to its assignment';
  end if;
end
$$;
