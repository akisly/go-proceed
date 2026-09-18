-- The replay that outlived the membership (DEV-020, BL-103).
--
-- WHAT WAS WRONG. 0006 wrote the two policies of public.idempotency_records as
--
--   idem_select  using (actor_scope = 'user:' || app.current_actor())
--   idem_insert  with check (actor_scope = 'user:' || app.current_actor()
--                            and (organization_id is null or <an active
--                                 membership of the actor in organization_id>))
--
-- so a record could be WRITTEN only by an active member of its workspace but
-- READ by its actor for as long as it lived. packages/database/src/
-- idempotency.ts replays whatever that read finds, before the route's callback
-- runs, and the callback is where the routes checked membership. A user whose
-- membership ended got the stored 2xx back on a repeated Idempotency-Key for the
-- retention window (thirty days, four hundred for ledger commands), and a
-- different body under the same key got 409 IDEMPOTENCY_CONFLICT, which told a
-- caller who may no longer act that the record existed.
--
-- WHAT THIS CHANGES. idem_select keeps its name, role (goproceed_app, which
-- goproceed_service inherits) and command, and takes idem_insert's own
-- predicate: a record is readable exactly when it could be written. A record
-- with no workspace (the bootstrap commands: creating a workspace or an
-- organization, accepting an invitation) stays fenced by its actor alone; its
-- body is the caller's own receipt, and the owner accepted that residual on
-- 2026-09-18.
--
-- This is the database half. It sees membership, not a workspace role or a
-- project capability: the application half — a required `authorize` step that
-- withIdempotency runs before its lookup — ships in the same commit and is what
-- refuses a demoted admin or a revoked project grant. Each half is safe without
-- the other, so either may deploy first: under the old code an invisible record
-- sends the call into its callback, whose membership check answers 403; under
-- the old policy the new code still authorizes first.
--
-- WHAT THIS DOES NOT CHANGE. idem_insert, every grant, app.delete_expired_
-- idempotency (0007; an ex-member never sees an expired row of the workspace,
-- so it is never asked to delete one, and the scheduled purge still does), and
-- every table, constraint and row. A re-admitted member (none can be re-admitted
-- today, BL-014) would see their records again, and authorize still runs.

alter policy idem_select on public.idempotency_records
  using (
    actor_scope = 'user:' || app.current_actor()::text
    and (organization_id is null
         or exists (select 1 from public.memberships m
                     where m.organization_id = idempotency_records.organization_id
                       and m.user_id = app.current_actor()
                       and m.status = 'active')));

-- Self-check: idem_select now asks for an active membership, is still a
-- permissive SELECT policy for goproceed_app only, and the table still carries
-- exactly its two policies.
do $$
declare
  qual text;
  policy_count int;
begin
  select p.qual into qual
    from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'idempotency_records'
     and p.policyname = 'idem_select' and p.cmd = 'SELECT'
     and p.permissive = 'PERMISSIVE' and p.roles = array['goproceed_app']::name[];
  if qual is null then
    raise exception '0089: idem_select is missing, or is no longer a permissive SELECT policy for goproceed_app alone';
  end if;
  if position('memberships' in qual) = 0 or position('''active''' in qual) = 0
     or position('actor_scope' in qual) = 0 then
    raise exception '0089: idem_select does not carry the actor and active-membership terms: %', qual;
  end if;
  select count(*) into policy_count
    from pg_policies where schemaname = 'public' and tablename = 'idempotency_records';
  if policy_count <> 2 then
    raise exception '0089: idempotency_records carries % policies, not 2', policy_count;
  end if;
end
$$;
