-- 0037: the last table without row level security joins the baseline.
--
-- Additive. Enables RLS on one table and withdraws one grant. No policy is
-- created, no row is written, no object is dropped.
--
-- docs/architecture/tenancy-and-security.md states the rule without exception:
-- enable ROW LEVEL SECURITY on every tenant table or view reachable by anon,
-- authenticated, a BFF application role, or a non-bypass worker role.
-- public.outbox_dead_letters meets every condition. It carries
-- organization_id, so it is tenant-owned; 0008 grants SELECT on it to
-- aktflow_worker; and 0008 creates that role `nologin nobypassrls`. It is the
-- only one of the 33 tables whose pg_class.relrowsecurity is false.
--
-- The exposure is latent rather than live — no login role is a member of
-- aktflow_worker today, so no session can currently reach the grant — which is
-- exactly why it is cheap to close now instead of at the moment the worker
-- gets a credential. The dead-letter `reason` column is a failure string from
-- another tenant's payload.
--
-- No policy accompanies the enable, and that is deliberate. RLS with no
-- policy denies every row to every non-owner, which is the correct posture
-- for a table the application must not read at all. A tenant-scoped policy
-- for aktflow_worker would be worse than none: every policy family in this
-- database keys off app.current_actor(), a per-request GUC a background
-- worker never sets, so the policy would return zero rows while reading as
-- though access had been granted. When a worker does need dead letters it
-- needs a principal and a policy designed together, not a policy now.
--
-- FORCE is deliberately NOT used. app.fail_outbox (0008) inserts dead letters
-- as the table owner inside a SECURITY DEFINER function; forcing RLS on the
-- owner would break the write path this table exists for.
--
-- Rollback:
--   alter table public.outbox_dead_letters disable row level security;
--   grant select on public.outbox_dead_letters to aktflow_worker;

alter table public.outbox_dead_letters enable row level security;

-- Withdraw the grant as well as enabling RLS. Either alone would deny the
-- read; together they make the intent legible to the next reader, and stop a
-- future policy from silently re-opening a path nobody re-argued.
revoke select on public.outbox_dead_letters from aktflow_worker;

comment on table public.outbox_dead_letters is
  'Exhausted outbox messages. RLS enabled with no policy (0037): denied to '
  'every non-owner. app.fail_outbox writes it as the table owner through '
  'SECURITY DEFINER, which RLS does not force. A worker that needs to read '
  'dead letters needs a login principal and a policy designed together — see '
  'docs/architecture/tenancy-and-security.md.';
