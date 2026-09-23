-- The bucket that took any type (DEV-040, BL-126's allow-list half).
--
-- WHAT WAS WRONG. 0020 created the private `evidence` bucket with a size limit
-- and no `allowed_mime_types`, so Storage stored whatever type the uploader's
-- PUT declared: `TEXT/HTML`, `image/svg+xml`, a list such as
-- `image/jpeg;x=1, TEXT/HTML`. Storage serves an object with that stored type,
-- and a signed read's `download=` flag sits outside the signature, so whoever
-- holds the URL can strip it (DEV-032, measured). Finalization now refuses a
-- stored type other than the detected one before the object becomes evidence
-- (DEV-032), but the hostile bytes were still accepted and kept until the
-- purge.
--
-- WHAT THIS CHANGES. The bucket accepts exactly the four types an upload grant
-- may name (apps/app/src/lib/evidence/authorize-upload-intent.ts FALLBACK_MEDIA;
-- the Telegram path takes three of them). Measured on the local storage API
-- v1.69.0 (DEV-040): the match is exact and case-sensitive; `IMAGE/JPEG`, a
-- type with parameters (`image/jpeg; charset=binary`), a type list, and a PUT
-- with no Content-Type are refused (the response body says 415
-- `invalid_mime_type`; storage-js 2.112.3 surfaces it as InvalidMimeType, 400);
-- surrounding whitespace is trimmed. The refusal comes before the object exists, so nothing
-- is stored and nothing needs purging.
--
-- WHAT THIS DOES NOT CHANGE. The size limit, `public = false`, and every
-- object already stored: Storage checks the type on upload only. Finalization's
-- stored-type check stays, as the second defence and for objects stored before
-- this migration. A requirement rule or template may name another type (its
-- contract admits any lowercase `type/subtype`), and the grant then accepts it;
-- but content inspection recognises only these four
-- (apps/app/src/lib/evidence-inspection.ts), so such an upload was already
-- refused at finalization and is now refused at the PUT instead.
--
-- Rollback: update storage.buckets set allowed_mime_types = null
--           where id = 'evidence';

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
 where id = 'evidence';

do $$
begin
  if not exists (
    select 1 from storage.buckets
     where id = 'evidence'
       and allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
  ) then
    raise exception '0093: the evidence bucket is missing or its allow-list did not apply';
  end if;
end $$;
