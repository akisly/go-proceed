-- The invitation token left in the receipt (DEV-019, BL-104, INV-102).
--
-- WHAT WAS WRONG. apps/app/app/v1/workspaces/[workspaceId]/invitations/route.ts
-- returned { invitationId, token, expiresAt } from inside its withIdempotency
-- callback, and packages/database/src/idempotency.ts stores whatever that
-- callback returns in public.idempotency_records.response_body for the
-- retention window (standard_30d). The raw invitation token — the bearer
-- credential public.invitations deliberately keeps only as token_hash — was
-- therefore stored in plain text beside it. app.accept_invitation (0011) checks
-- the hash and that the caller is not yet a member, not the invited email
-- (BL-013), so anyone able to read this table outside the API could accept a
-- pending invitation with its role.
--
-- The code fix ships in the same commit: the callback now returns a strict
-- token-free receipt, the token is attached outside the block only when the
-- block ran, and a replay is built from named fields, so the API never serves a
-- stored token again whether or not this migration has run.
--
-- WHAT THIS CHANGES. It removes the `token` key from every stored
-- invitations.create response body. Nothing else: no policy, grant, table,
-- constraint or function changes, and no other operation's rows are touched.
-- `- 'token'` leaves an object, so idempotency_records_check1 (a completed row
-- keeps a non-null body) still holds, and a replay of a cleaned row returns the
-- token-free receipt the new route builds anyway.
--
-- WHAT THIS DOES NOT REACH. Backups and point-in-time recovery taken before it
-- ran keep their copies; a token stays usable only while its invitation is
-- pending and unexpired (at most 720 hours, packages/contracts/src/invitations.ts).
--
-- ORDER. Deploy the application build FIRST, then apply this migration: rows
-- written by the old build between the two steps would otherwise keep their
-- token, and this UPDATE would have to be run again by hand. It is idempotent,
-- so running it again is safe. Applied locally by hand as postgres; applied to
-- no hosted project by DEV-019.

update public.idempotency_records
   set response_body = response_body - 'token'
 where operation_id = 'invitations.create'
   and jsonb_typeof(response_body) = 'object'
   and response_body ? 'token';

-- Self-check: no stored invitations.create body carries a token any more.
do $$
declare
  remaining bigint;
begin
  select count(*) into remaining
    from public.idempotency_records
   where operation_id = 'invitations.create'
     and jsonb_typeof(response_body) = 'object'
     and response_body ? 'token';
  if remaining <> 0 then
    raise exception '0088: % invitations.create records still carry a token', remaining;
  end if;
end
$$;
