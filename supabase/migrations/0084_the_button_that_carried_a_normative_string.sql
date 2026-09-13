-- 0084 — the button that carried a normative string
--
-- M0 gate 9 — «no normative string renderable without its `verification` tag
-- and its source» — reaches every renderer, and this module has two. The
-- assignment card was fixed in the application layer; the requirement-choice
-- prompt was not, and it is fed from here: `0071`'s
-- `app.resolve_telegram_evidence_context` returns
-- `left(o.acceptance_criterion,120)` as `label`, and the processor puts that
-- label on an inline-keyboard button. So a requirement's own words reached the
-- same закрита група truncated, with no tag and no source — including the
-- words the card had just WITHHELD, because the card's snapshot carries every
-- occurrence id and this function reads the snapshot.
--
-- A Telegram button label cannot be the place a citation lives: the source of a
-- Додаток Н item is ~300 characters. So the function stops composing a display
-- string at all and returns the FACTS — the criterion and the three citation
-- columns — and the prompt message carries the attributed list while the button
-- carries the number of a line. `apps/app/src/lib/telegram/cards.ts`
-- (`formatRequirementChoicePrompt`) is the renderer; it shares
-- `renderRequirements` with the card, so the two cannot drift apart on the rule
-- they both answer to.
--
-- The test this migration answers:
-- `apps/app/tests/telegram-evidence.int.test.ts` «offers requirements with
-- their tag and source, and never on a button», with the unit halves in
-- `apps/app/src/lib/telegram/cards.test.ts` §"the requirement-choice prompt".
--
-- DROP AND CREATE, NOT REPLACE. The OUT columns are part of the signature, so
-- `create or replace` refuses to change them; the drop takes the grants with
-- it and they are re-issued below exactly as `0068` issued them.
--
-- THE ORDER NOW MATCHES THE CARD. `0071` ordered by `o.ordinal, o.id` while the
-- card route orders by timing rank first (`0043:765-767` calls that the
-- canonical order and indexes it, and states ordinal is deliberately
-- non-unique), so the two numbered lists could disagree about which requirement
-- is «1». They are one order now. The prompt remains a SUBSET — it still shows
-- only `photo`/`document` occurrences of the snapshot — so its numbering is its
-- own; nothing in the product asks a reader to match a prompt number against a
-- card number.

drop function if exists app.resolve_telegram_evidence_context(uuid,uuid,uuid,bigint,bigint);

create function app.resolve_telegram_evidence_context(
  p_workspace_id uuid,p_project_id uuid,p_binding_id uuid,p_sender_id bigint,p_reply_message_id bigint
) returns table (assignment_id uuid,actor_user_id uuid,occurrence_id uuid,allowed_media jsonb,
                 criterion text,norm_ref text,norm_ref_verification text,norm_ref_source text)
language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram evidence context requires service principal';
  end if;
  return query select card.work_assignment_id,m.user_id,o.id,rv.allowed_media,
                      o.acceptance_criterion,o.norm_ref,o.norm_ref_verification,o.norm_ref_source
    from public.telegram_member_links l
    join public.memberships m on m.organization_id=l.workspace_id and m.id=l.member_id
    join public.project_access_grants g on g.workspace_id=l.workspace_id and g.project_id=p_project_id
      and g.member_id=l.member_id and g.capability='evidence.record'
      and g.revoked_at is null and g.valid_from <= now() and (g.valid_until is null or g.valid_until > now())
    join public.communication_messages card on card.workspace_id=l.workspace_id and card.project_id=p_project_id
      and card.telegram_chat_binding_id=p_binding_id and card.provider_message_id=p_reply_message_id
      and card.kind='assignment_card' and card.delivery_state='provider_accepted' and card.work_assignment_id is not null
    join public.requirement_occurrences o on o.workspace_id=card.workspace_id and o.project_id=card.project_id
      and o.work_assignment_id=card.work_assignment_id
    join public.requirement_rule_versions rv on rv.workspace_id=o.workspace_id and rv.id=o.rule_version_id
   where l.workspace_id=p_workspace_id and l.telegram_user_id=p_sender_id and l.revoked_at is null
     and m.status='active' and card.telegram_occurrence_snapshot @> array[o.id]
     and o.evidence_kind in ('photo','document')
   order by case o.timing when 'before_work' then 1 when 'during' then 2 when 'before_concealment' then 3
                          when 'after' then 4 when 'before_package' then 5 end, o.ordinal, o.id;
end $$;

revoke all on function app.resolve_telegram_evidence_context(uuid,uuid,uuid,bigint,bigint)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.resolve_telegram_evidence_context(uuid,uuid,uuid,bigint,bigint)
  to goproceed_service;
