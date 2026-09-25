-- 0104: the service plane stops holding four Telegram write grants that only
-- SECURITY DEFINER functions use.
--
-- Append-only; withdraws grants. No policy, no column, no row.
--
-- 0062 granted select, insert, update on seven Telegram and communication
-- tables to goproceed_service. On four of them, part of that grant is used by
-- no product code:
--
--   - telegram_binding_intents UPDATE and telegram_member_link_intents UPDATE:
--     the BFF only inserts an intent (binding-intents and member-link-intents
--     routes); an intent is consumed by app.consume_telegram_binding_intent and
--     app.consume_telegram_member_link_intent (0085), and an expired one is
--     deleted by app.apply_communication_retention (0081);
--   - telegram_chat_bindings INSERT: a binding is created only by
--     app.consume_telegram_binding_intent (0085);
--   - telegram_member_links INSERT and UPDATE: a link is created or relinked
--     only by app.consume_telegram_member_link_intent (0085) and cleared only by
--     the erasure functions (0085); the BFF reads it and nothing more.
--
-- Those functions are SECURITY DEFINER, owned by postgres, and run with their
-- owner's rights, so they keep working. Nothing in apps/, packages/, scripts/
-- or supabase/functions/ uses the withdrawn privileges outside tests,
-- and every test fixture that does writes them as the admin role (grep for
-- INSERT, UPDATE, ON CONFLICT DO UPDATE and MERGE, DEV-078).
--
-- telegram_chat_bindings keeps its UPDATE grant: three routes lock a binding
-- with `FOR UPDATE OF b`, which needs UPDATE on at least one column (owner,
-- 2026-09-25, DEV-078). No product path updates a binding; narrowing the grant
-- to one inert column is BL-175. Every SELECT grant stays.
--
-- DEV-078 (BL-165) found these while writing the cross-workspace write-denial
-- tests the DEV-076 minimum asks of every covered row that holds a write. The
-- minimum (docs/delivery/test-strategy.md §4) lets an unused write grant be
-- revoked instead of tested; the owner chose that for these four on
-- 2026-09-25 (DEV-078). With them gone, a binding or a member link can come
-- into being only by consuming an intent (INV-092).
--
-- Rollback:
--   grant update on public.telegram_binding_intents, public.telegram_member_link_intents to goproceed_service;
--   grant insert on public.telegram_chat_bindings to goproceed_service;
--   grant insert, update on public.telegram_member_links to goproceed_service;
-- and, in the same change, the four rows of technical/database/rls-write-coverage.csv,
-- their baseline keys and the privilege-refusal assertions of
-- packages/testing/src/communication-write-rls.test.ts, which otherwise fail
-- with rls-coverage.test.ts.

revoke update on public.telegram_binding_intents, public.telegram_member_link_intents from goproceed_service;
revoke insert on public.telegram_chat_bindings from goproceed_service;
revoke insert, update on public.telegram_member_links from goproceed_service;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['goproceed_app', 'goproceed_service'] loop
    if has_any_column_privilege(role_name, 'public.telegram_binding_intents', 'UPDATE')
       or has_any_column_privilege(role_name, 'public.telegram_member_link_intents', 'UPDATE')
       or has_table_privilege(role_name, 'public.telegram_chat_bindings', 'INSERT')
       or has_any_column_privilege(role_name, 'public.telegram_chat_bindings', 'INSERT')
       or has_any_column_privilege(role_name, 'public.telegram_member_links', 'INSERT')
       or has_any_column_privilege(role_name, 'public.telegram_member_links', 'UPDATE') then
      raise exception '0104: % still holds a withdrawn Telegram write grant', role_name;
    end if;
  end loop;
  if not has_table_privilege('goproceed_service', 'public.telegram_member_links', 'SELECT')
     or not has_table_privilege('goproceed_service', 'public.telegram_chat_bindings', 'SELECT')
     or not has_any_column_privilege('goproceed_service', 'public.telegram_chat_bindings', 'UPDATE')
     or not has_table_privilege('goproceed_service', 'public.telegram_binding_intents', 'INSERT')
     or not has_table_privilege('goproceed_service', 'public.telegram_member_link_intents', 'INSERT') then
    raise exception '0104: a grant the product uses was withdrawn';
  end if;
end
$$;
