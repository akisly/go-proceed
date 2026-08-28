-- 0060: the retirement that raced itself.
--
-- WHAT THIS CHANGES
--   One function body, in place: app.retire_requirement_rule_version(uuid,
--   uuid) — created by 0041 §7 — gains the compare-and-swap its younger
--   sibling app.archive_project_sourced_requirement_item was born with
--   (0059), `and status = 'published'` on the UPDATE's WHERE clause. Nothing
--   else about the function moves: same arguments, same authorization-first
--   order, same idempotency-by-state branch, same raise messages.
--
-- WHY
--   TODOS.md, residual 4 of the 2026-08-27 slice. The 0041 body SELECT-checks
--   the status, then UPDATEs with no status filter. Two concurrent calls can
--   both pass the SELECT ('published'); the loser's UPDATE then blocks on the
--   winner's row lock, re-evaluates its WHERE against the committed row once
--   unblocked, still matches — the WHERE had no status filter — and the guard
--   trigger (0041 §7) RAISES on the retired -> retired transition it is then
--   asked to admit. So a racing call to an operation scope-v0.1.csv:30 marks
--   idempotency-required errors instead of being the promised no-op — and had
--   the guard not been there, the loser would instead have re-stamped
--   retired_at and retired_by_member_id with its own, rewriting when future
--   binding stopped and who stopped it. With the status filter, the loser's
--   re-evaluated WHERE matches nothing: no error, no state change, exactly
--   what the sequential replay already promises. Driven and proved by the
--   forced-interleave case in packages/testing/src/m1-rules-schema.test.ts
--   («keeps the first retiree when a second one RACES it»), which polls
--   pg_stat_activity for the blocked backend — the sibling archive race test's
--   own instrument, because its first, timing-based version passed against the
--   unfixed function.
--
-- WHAT THIS DOES NOT CHANGE
--   No table, no column, no trigger, no policy, no grant surface. Migrations
--   0001–0059 are applied history and are not edited; this is a corrective
--   forward migration over one function body, the pattern 0017 set. The guard
--   trigger keeps every one of its refusals — the CAS prevents the racing
--   UPDATE from reaching it, it does not relax what the guard admits. The
--   function's search_path moves from `public, pg_temp` (0041's spelling) to
--   the empty string (0059's): every reference in the body is already
--   schema-qualified, so resolution is unchanged and the surface an attacker
--   could load an object into is smaller.
--
-- ROLLBACK (dev only)
--   Re-run 0041 §7's create or replace (the same body without
--   `and status = 'published'` and with `set search_path = public, pg_temp`).
--   There is no data to migrate in either direction: the CAS changes which of
--   two racing statements writes, never what a written row holds.

-- ===========================================================================
-- The retire command, with the compare-and-swap
--
-- The shape is 0041 §7's, restated: no UPDATE grant exists on
-- requirement_rule_versions, so retirement is this SECURITY DEFINER function
-- or nothing; authorization runs before anything is read so a raise message
-- cannot become a cross-tenant oracle; the actor comes from
-- app.active_member_id() and never from an argument.
-- ===========================================================================
create or replace function app.retire_requirement_rule_version(
  p_workspace uuid, p_rule_version uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_status text;
begin
  v_member := app.active_member_id(p_workspace);
  if v_member is null or app.member_role(p_workspace) not in ('owner','admin') then
    raise exception 'not authorized to retire a requirement rule version in this workspace';
  end if;

  select status into v_status
    from public.requirement_rule_versions
   where workspace_id = p_workspace and id = p_rule_version;

  if v_status is null then
    raise exception 'unknown requirement rule version';
  end if;
  -- Retirement is idempotent by state: the operation is idempotency-required in
  -- scope-v0.1.csv:30 and a replay must not raise.
  if v_status = 'retired' then
    return;
  end if;
  if v_status <> 'published' then
    raise exception 'only a published requirement rule version can be retired';
  end if;

  -- COMPARE-AND-SWAP, not a plain UPDATE: two concurrent calls to
  -- app.retire_requirement_rule_version can both pass the status read above,
  -- and the loser then re-evaluates this WHERE against the winner's committed
  -- row — so `status = 'published'` is what makes it match nothing instead of
  -- carrying retired -> retired into the guard's raise. The same clause, for
  -- the same reason, as app.archive_project_sourced_requirement_item (0059).
  update public.requirement_rule_versions
     set status = 'retired', retired_at = now(), retired_by_member_id = v_member
   where workspace_id = p_workspace and id = p_rule_version
     and status = 'published';
end $$;
revoke all on function app.retire_requirement_rule_version(uuid, uuid) from public;
grant execute on function app.retire_requirement_rule_version(uuid, uuid) to goproceed_app;
