-- ============================================================================
-- The Surgeon Group — Franchisee Portal: make document storage private
--
-- RUN THIS ONLY AFTER push_portal_25nov.bat has finished and Vercel has redeployed.
-- The new portal code asks for a short-lived signed link each time a file is opened;
-- the old code needs the bucket to be public.
--
-- After this, a file link copied out of the portal stops working within minutes, and
-- nobody can open a file without being logged in. Logged-in users can still open files
-- the portal shows them (file names are long and random).
--
-- To undo:  update storage.buckets set public = true where id = 'franchise-documents';
-- ============================================================================

begin;

-- Logged-in users may read files in the bucket (needed to create signed links).
drop policy if exists "portal read franchise-documents" on storage.objects;
create policy "portal read franchise-documents" on storage.objects
  for select to authenticated using (bucket_id = 'franchise-documents');

update storage.buckets set public = false where id = 'franchise-documents';

commit;

-- Check: should return  franchise-documents | false
select id, public from storage.buckets where id = 'franchise-documents';
