-- The one service policy in the telegram family that refused its own writer.
--
-- 0068:40-67 gave public.telegram_requirement_choice_sessions a service policy
-- built from three EXISTS over public.project_field_channels,
-- public.telegram_chat_bindings and public.work_assignments. Two of those
-- tables carry only `to goproceed_app` policies keyed on
-- app.has_project_capability(), which resolves app.current_actor(). And
-- goproceed_service is an INHERIT member of goproceed_app (pg_auth_members,
-- rolinherit = true), so inside the EXISTS the member-plane policies bind the
-- service plane too. Every writer of this table runs with an empty actor —
-- processor.ts: withServiceTx({ actorUserId: "", organizationId: ... }) — so
-- current_actor() is NULL, has_project_capability() is false, the EXISTS is
-- false, and every INSERT from evidence.ts (the choice a foreman is offered
-- when one photo matches more than one requirement) raised «new row violates
-- row-level security policy». The feature was built and could not run.
--
-- Reproduced 2026-09-02 on the local stack at 0079, read-only: as
-- goproceed_service with the workspace GUC set and the actor empty, a
-- well-formed row is refused with 42501 before any foreign key is checked.
-- EXPLAIN shows why — SubPlan 1 on project_field_channels carries
-- `app.has_project_capability(...)` and no `service_workspace()` alternative.
-- Found by the /cso audit and not by a test, because the suite that walks
-- this path (apps/app/tests/telegram-evidence.int.test.ts) is gated on
-- TEST_DB_ADMIN_URL, which CI did not set until the commit beside this one.
--
-- The policy now says what its ten siblings in 0062:669-717 say: the row's
-- workspace is the one the service transaction declared. The three EXISTS
-- guarded referential shape, and the table's own foreign keys already guard
-- it (0067:66-79 — (workspace_id, project_id) to project_field_channels,
-- (workspace_id, project_id, telegram_chat_binding_id) to
-- telegram_chat_bindings, (workspace_id, project_id, work_assignment_id) to
-- work_assignments), so nothing the EXISTS proved is lost. The grant from
-- 0068:70 stands as it was.
--
-- packages/testing/src/telegram-rls.test.ts pins both directions: a row for
-- the declared workspace passes the policy and is stopped by the foreign keys
-- (23503), a row for another workspace is stopped by the policy (42501).

drop policy if exists telegram_requirement_choice_sessions_service
  on public.telegram_requirement_choice_sessions;

create policy telegram_requirement_choice_sessions_service
  on public.telegram_requirement_choice_sessions
  for all to goproceed_service
  using (workspace_id = app.service_workspace())
  with check (workspace_id = app.service_workspace());
