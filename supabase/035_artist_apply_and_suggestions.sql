-- Artist Apply + Fan Suggestion Box
--
-- Two small additions to support the new landing-page tabs:
--
-- 1. promoter_requests.kind — distinguishes promoter applications from
--    artist applications so JP has one inbox + one approval flow but can
--    tell them apart. Default 'promoter' so existing rows are unaffected.
--
-- 2. artist_suggestions — fans on the Fan tab submit "we should add this
--    artist" notes via the empty-search state. JP triages from /admin
--    (UI not in MVP; query directly in Supabase for now).

alter table public.promoter_requests
  add column if not exists kind text not null default 'promoter'
    check (kind in ('promoter', 'artist'));

create index if not exists promoter_requests_kind_idx
  on public.promoter_requests(kind, created_at desc);

create table if not exists public.artist_suggestions (
  id                  uuid primary key default gen_random_uuid(),
  artist_name         text not null,
  suggested_by_email  text,
  suggested_by_name   text,
  note                text,
  created_at          timestamptz not null default now()
);

create index if not exists artist_suggestions_created_idx
  on public.artist_suggestions(created_at desc);

alter table public.artist_suggestions enable row level security;

-- Public inserts (the form is unauthenticated). Reads are admin-only via
-- service role; we don't expose this list to anonymous users.
drop policy if exists "Public inserts to artist_suggestions" on public.artist_suggestions;
create policy "Public inserts to artist_suggestions"
  on public.artist_suggestions for insert with check (true);

drop policy if exists "Admin reads artist_suggestions" on public.artist_suggestions;
create policy "Admin reads artist_suggestions"
  on public.artist_suggestions for select
  using (
    exists (select 1 from users where id = auth.uid() and is_admin = true)
  );
