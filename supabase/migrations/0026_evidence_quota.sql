-- 0026: correction from the pre-landing review of v0.1-M2-A.
--
-- Additive. Adds one column to public.organizations.
--
-- Why: upload_intents.quota_reserved_bytes has existed since 0015 and nothing
-- ever wrote or read it. The upload protocol says the server "validates actor,
-- assignment, requirement, expected type/size, and quota before issuing the
-- destination" (docs/domain/execution-and-evidence.md); everything but quota
-- was true. A workspace could authorize unlimited uploads.
--
-- The LIMIT is deliberately not chosen here. 0015 already records the external
-- gate: "per-workspace storage quota values and scan-blocked retention periods
-- come from the approved retention schedule, not defaults here." So the column
-- is nullable and NULL means unlimited, which is exactly today's behaviour —
-- the mechanism ships, the number stays a decision. A workspace with a limit
-- set is enforced; one without is unchanged.
--
-- Rollback (dev only): drop the column.

alter table public.organizations
  add column evidence_quota_bytes bigint
    check (evidence_quota_bytes is null or evidence_quota_bytes > 0);

comment on column public.organizations.evidence_quota_bytes is
  'Total evidence bytes this workspace may hold, counting available originals '
  'plus bytes reserved by live upload intents. NULL means unlimited, which is '
  'the pre-0026 behaviour; the real figure comes from the approved retention '
  'schedule (EXTERNAL GATE, see 0015).';

-- ---------------------------------------------------------------------------
-- What a workspace currently holds: evidence that exists, plus bytes promised
-- to intents that are still live. An intent that expired, was blocked, was
-- orphaned or has been purged reserves nothing.
-- ---------------------------------------------------------------------------
create or replace function app.evidence_bytes_in_use(p_workspace uuid)
returns bigint
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select sum(byte_size) from public.evidence_objects
                    where workspace_id = p_workspace), 0)
       + coalesce((select sum(quota_reserved_bytes) from public.upload_intents
                    where workspace_id = p_workspace
                      and status = 'intent_authorized'
                      and purged_at is null
                      and expires_at > now()), 0);
$$;
revoke all on function app.evidence_bytes_in_use(uuid) from public;
grant execute on function app.evidence_bytes_in_use(uuid) to aktflow_app;
