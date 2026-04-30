-- Storage buckets — declare them here so they survive a fresh
-- environment instead of needing manual dashboard clicks.
--
-- Pattern for any new bucket:
--   1. insert into storage.buckets ... on conflict do nothing
--   2. drop policy if exists ... + create policy ...  for read/write rules
--
-- All buckets in this file are PUBLIC reads (anyone can fetch URLs).
-- Writes are gated to authenticated users (promoters); anon RLS would
-- let any random visitor upload garbage.
--
-- Idempotent.

-- ─── bar-photos ───────────────────────────────────────────────────────────
-- Promoter-uploaded images for custom drink menu items (StepBar.jsx).
insert into storage.buckets (id, name, public)
values ('bar-photos', 'bar-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read on bar-photos" on storage.objects;
create policy "Public read on bar-photos"
  on storage.objects for select
  using (bucket_id = 'bar-photos');

drop policy if exists "Authenticated upload to bar-photos" on storage.objects;
create policy "Authenticated upload to bar-photos"
  on storage.objects for insert
  with check (bucket_id = 'bar-photos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update on bar-photos" on storage.objects;
create policy "Authenticated update on bar-photos"
  on storage.objects for update
  using (bucket_id = 'bar-photos' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete on bar-photos" on storage.objects;
create policy "Authenticated delete on bar-photos"
  on storage.objects for delete
  using (bucket_id = 'bar-photos' and auth.role() = 'authenticated');
