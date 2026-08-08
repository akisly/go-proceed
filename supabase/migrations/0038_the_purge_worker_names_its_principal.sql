-- 0038: the purge functions name a principal other than the superuser.
--
-- Additive. Widens four revokes and adds eight grants. No function body
-- changes, no table is touched, no row is written.
--
-- 0021 revoked all four purge functions from PUBLIC and granted them to
-- nobody. They still execute today, because their only caller connects as the
-- owner — pg_cron runs expire_upload_intents as the scheduling superuser, and
-- apps/app/src/lib/evidence-purge.ts defaults to the superuser URL. So the
-- honest statement is not "the purge worker cannot run"; it is that the purge
-- has no principal but postgres, and every future caller therefore has to be
-- a superuser too.
--
-- Two things follow. First, 0021's revoke was incomplete in the same way 0005
-- documented for drain_outbox: revoking from PUBLIC does not strip the direct
-- EXECUTE the local Supabase stack grants to anon and authenticated at
-- function-creation time. Those two roles are browser-reachable and can
-- currently call all four. That is the part of this migration that closes an
-- exposure rather than improving posture.
--
-- Second, the grants go to aktflow_worker (the non-bypass background role
-- 0008 created) and service_role (the key the Edge Function runtime holds),
-- which are the two identities a deployed purge runner can plausibly have.
-- They deliberately do NOT go to aktflow_app: purging is a cross-tenant system
-- action, and 0021's own comment says so. They do not go to aktflow_service
-- either — that principal exists for upload finalization (0034), and widening
-- it here would undo the separation 0034/0035 established.
--
-- This migration does NOT make the purge work. The byte-deleting half is
-- wired to no runtime, so nothing is deleted from storage after it as before
-- it. What changes is that when a runner is wired, it no longer has to be a
-- superuser. The runner itself is tracked in TODOS.md.
--
-- Rollback:
--   revoke execute on function public.expire_upload_intents()          from aktflow_worker, service_role;
--   revoke execute on function public.claim_upload_purge(integer)      from aktflow_worker, service_role;
--   revoke execute on function public.complete_upload_purge(uuid)      from aktflow_worker, service_role;
--   revoke execute on function public.fail_upload_purge(uuid, text)    from aktflow_worker, service_role;
-- Do NOT restore the anon/authenticated grants: they were never intended and
-- 0021 only failed to strip them.

revoke all on function public.expire_upload_intents()       from public, anon, authenticated;
revoke all on function public.claim_upload_purge(integer)   from public, anon, authenticated;
revoke all on function public.complete_upload_purge(uuid)   from public, anon, authenticated;
revoke all on function public.fail_upload_purge(uuid, text) from public, anon, authenticated;

grant execute on function public.expire_upload_intents()       to aktflow_worker, service_role;
grant execute on function public.claim_upload_purge(integer)   to aktflow_worker, service_role;
grant execute on function public.complete_upload_purge(uuid)   to aktflow_worker, service_role;
grant execute on function public.fail_upload_purge(uuid, text) to aktflow_worker, service_role;
