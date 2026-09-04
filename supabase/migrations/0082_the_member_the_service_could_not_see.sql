-- The member the service plane could not see.
--
-- WHAT THIS ADDS. One SECURITY DEFINER function,
-- app.resolve_telegram_linked_member(workspace, telegram_user_id), returning
-- the linked, active member (and their user id) for a Telegram sender in the
-- workspace the service transaction has declared. Nothing else: no policy, no
-- table grant, no column.
--
-- WHY. processor.ts's storeMessage resolves the author of every inbound
-- Telegram message with an inline join of public.telegram_member_links to
-- public.memberships (linkedMemberId). telegram_member_links carries a service
-- policy (`workspace_id = app.service_workspace()`, 0062). memberships does
-- not: its only policies are member-plane — m_select (`user_id =
-- app.current_actor()`) and m_select_workspace (`app.active_member_id(...)`),
-- both resolving app.current_actor(), which every service transaction leaves
-- empty. goproceed_service is an INHERIT member of goproceed_app, so those
-- policies bind the service plane too, and the join found no membership for
-- anyone. Measured 2026-09-04 on the local stack at 0081, read-only, as
-- goproceed_service with the workspace GUC set and the actor empty:
-- `select count(*) from public.memberships` → 0 against a table holding one
-- row; and inside apps/app/tests/telegram-evidence.int.test.ts «authorizes
-- every album part against the same card anchor and uploader», every
-- communication_messages.author_member_id and the album's
-- telegram_media_groups.uploader_member_id came back NULL.
--
-- What that NULL cost, in order of what the design promises:
--   * every inbound message from a linked member was filed as
--     `stored_unverified_message`, the disposition the 2026-08-28 design §11
--     reserves for an UNLINKED participant;
--   * an album's uploader was unknown, so 0071's claim-time classification
--     (`m.author_member_id is distinct from g.uploader_member_id` →
--     album_uploader_mismatch) compared NULL with NULL and passed a second
--     member's part into the first member's submission — the part was
--     downloaded and made evidence under the first member's card reply
--     (INV-097: «same linked uploader»);
--   * 0070's choice-expiry receipt, addressed to `g.uploader_member_id`,
--     raised «recipient must be the original uploader» against the session's
--     real uploader, so no expired album choice was ever told it expired;
--   * 0075's return-reply resolver requires `reply.author_member_id =
--     t.actor_member_id`, which a NULL author never satisfies.
--
-- The house answer to a service-plane read of a member-plane table is the
-- same as at 0062's ingress, 0064, 0075 and 0078: a definer that fixes what
-- the caller may not choose. This one is bounded to the declared workspace
-- (`p_workspace_id is distinct from app.service_workspace()` raises — the
-- guard 0078 explains), returns one row or none, and is executable by
-- goproceed_service alone.
--
-- WHAT THIS DOES NOT CHANGE. memberships keeps its two member-plane policies;
-- no service policy is added to it, on purpose — the service plane needs one
-- lookup, not a table. The evidence-context definer of 0071
-- (app.resolve_telegram_evidence_context) already reads memberships the same
-- way for the card-reply path; this function is its counterpart for the
-- message-store and choice-callback paths.
--
-- Pinned by packages/testing/src/telegram-rls.test.ts
-- «§ app.resolve_telegram_linked_member (0082)» and, end to end, by
-- apps/app/tests/telegram-evidence.int.test.ts «authorizes every album part
-- against the same card anchor and uploader». Recorded as DA-173 in
-- technical/data-access-surface.csv; INV-097's enforcement column names it.
--
-- ROLLBACK (dev only): drop function app.resolve_telegram_linked_member(uuid, bigint).

create function app.resolve_telegram_linked_member(
  p_workspace_id uuid, p_telegram_user_id bigint
) returns table (member_id uuid, user_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram linked-member resolution requires the service principal';
  end if;
  if p_workspace_id is null or p_telegram_user_id is null then
    raise exception 'telegram linked-member resolution identity is required';
  end if;
  if p_workspace_id is distinct from app.service_workspace() then
    raise exception 'telegram linked-member resolution workspace is not the declared workspace';
  end if;
  return query
    select l.member_id, m.user_id
      from public.telegram_member_links l
      join public.memberships m
        on m.organization_id = l.workspace_id and m.id = l.member_id
     where l.workspace_id = p_workspace_id
       and l.telegram_user_id = p_telegram_user_id
       and l.revoked_at is null
       and m.status = 'active'
     limit 1;
end $$;

revoke all on function app.resolve_telegram_linked_member(uuid, bigint)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.resolve_telegram_linked_member(uuid, bigint) to goproceed_service;
