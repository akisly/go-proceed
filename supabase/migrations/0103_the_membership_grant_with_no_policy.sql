-- 0103: the UPDATE grant on memberships stops claiming a path that is not there.
--
-- Additive. Withdraws one grant. No policy, no column, no row.
--
-- 0003 granted select, insert, update on public.memberships to the application
-- role (now goproceed_app). 0004 enabled RLS on the table and gave it SELECT
-- and INSERT policies only; no migration since has added an UPDATE policy. With
-- RLS on and no permissive UPDATE policy, every UPDATE by goproceed_app matches
-- zero rows and commits, silently. The grant has never been usable.
--
-- DEV-077 (BL-164) found it while writing the cross-workspace write-denial test
-- the DEV-076 minimum asks of every covered row that holds a write: a test of
-- an UPDATE must first succeed on the member's own rows, and here nothing can.
-- The owner ruled on 2026-09-24 that an unused write grant is revoked rather
-- than tested, and on 2026-09-25 that this one is.
--
-- Nothing in apps/, packages/ or scripts/ updates memberships or takes a row
-- lock on them (grep for UPDATE, FOR UPDATE / SHARE, ON CONFLICT DO UPDATE and
-- MERGE, DEV-077); the functions that change a membership are SECURITY DEFINER
-- and run with their owner's rights, not goproceed_app's. goproceed_service
-- reached the grant through its membership in goproceed_app and loses it too.
--
-- The 0039 precedent: remove the false affordance rather than build the
-- missing one. A member-management command that needs to change a membership
-- adds a column-scoped UPDATE grant, an owner/admin policy and its capability
-- in one migration, never the policy alone.
--
-- Rollback:
--   grant update on public.memberships to goproceed_app;
-- (which restores an equally inert privilege; the policy gap is unchanged.)

revoke update on public.memberships from goproceed_app;

do $$
begin
  if has_any_column_privilege('goproceed_app', 'public.memberships', 'UPDATE')
     or has_any_column_privilege('goproceed_service', 'public.memberships', 'UPDATE') then
    raise exception '0103: UPDATE on public.memberships is still held by a product role';
  end if;
end
$$;
