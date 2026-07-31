-- 0020: the private evidence bucket.
--
-- One bucket, not the staging/originals pair the plan first sketched. Promoting
-- an object between buckets cannot be atomic with the PostgreSQL transaction
-- that creates the evidence row, so a crash or rollback in between leaves bytes
-- nobody references, or a sweep that deletes bytes a committing transaction is
-- about to claim (engineering review, finding D3).
--
-- Removing the move removes the problem. The storage key is issued when the
-- upload intent is authorized and never changes (INV-045). Visibility is a
-- PostgreSQL fact throughout: staged bytes are not evidence because no
-- evidence_objects row points at them, exactly as
-- docs/architecture/files-and-storage.md already states ("An object existing in
-- storage does not make it evidence").
--
-- The two logical classes in that document remain separated by policy rather
-- than by bucket, which the document explicitly allows. Retention is enforced by
-- the purge job reading domain state, because "delete if no evidence row after
-- 24 hours" is not expressible as bucket lifecycle.

insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 52428800)
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit;

-- No policy is created for anon or authenticated on storage.objects for this
-- bucket, so RLS denies them by default. Every read and write goes through the
-- server with the service role, which checks PostgreSQL first.
