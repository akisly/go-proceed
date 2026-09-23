-- The grant that could be rewritten (DEV-043, BL-021, ADR-014 decision 4).
--
-- WHAT WAS WRONG. 0011 granted `update` on public.project_access_grants to the
-- application role table-wide, so the only fence on an UPDATE was `pag_update`,
-- which asks whether the actor administers the grant's project. Nothing in the
-- product wrote that UPDATE until now; a defect in the BFF, or the new revoke
-- route written carelessly, could have moved a grant to another member or
-- capability, re-dated its window, or changed who granted it, on any project the
-- actor administers — and the composite foreign keys would only have kept it in
-- the same workspace.
--
-- WHAT THIS CHANGES. `project_access.revoke` (ADR-014 decision 1) writes
-- `revoked_at` and `version` and nothing else, so those are the two columns the
-- application role may update. A table-level REVOKE also removes any column
-- privilege of the same kind (PostgreSQL 17, «REVOKE»), which is why the revoke
-- comes first. `select for update`, which the route takes on the rows it
-- revokes, needs UPDATE on at least one column and keeps working. The service
-- role inherits the application role's table grants (BL-019) and is narrowed
-- with it.
--
-- WHAT THIS DOES NOT CHANGE. `pag_update` (USING and WITH CHECK
-- `project.admin` on the grant's project) stays as it is. RLS cannot compare the
-- old row with the new one, so the product can still clear `revoked_at` through a
-- defect; a write-once trigger is not part of ADR-014 (BL-138). Superuser
-- sessions, and the fixtures that use them, are unaffected.
--
-- Rollback: revoke update on public.project_access_grants from goproceed_app;
--           grant update on public.project_access_grants to goproceed_app;

revoke update on public.project_access_grants from goproceed_app;
grant update (revoked_at, version) on public.project_access_grants to goproceed_app;

do $$
begin
  if has_table_privilege('goproceed_app', 'public.project_access_grants', 'UPDATE') then
    raise exception '0096: goproceed_app still holds table-wide UPDATE on project_access_grants';
  end if;
  if not has_column_privilege('goproceed_app', 'public.project_access_grants', 'revoked_at', 'UPDATE')
     or not has_column_privilege('goproceed_app', 'public.project_access_grants', 'version', 'UPDATE')
     or has_column_privilege('goproceed_app', 'public.project_access_grants', 'member_id', 'UPDATE')
     or has_column_privilege('goproceed_app', 'public.project_access_grants', 'capability', 'UPDATE') then
    raise exception '0096: goproceed_app column UPDATE on project_access_grants is not exactly (revoked_at, version)';
  end if;
end $$;
