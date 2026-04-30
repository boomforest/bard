-- Replace single-purpose grail_subscribers with a unified `subscribers`
-- table that supports multiple lists. Buyer opts in once → row written
-- to both 'grail_plus' (platform list) and 'casa_de_copas' (JP's
-- personal parties list). Admin backend filters by list.
--
-- Captures zip + radius_miles so blasts can be filtered by area later
-- (same shape as promoter_followers — schema captures the geo intent
-- even though v1 blasts will likely send to all).
--
-- Idempotent. Safe to re-run.

drop table if exists grail_subscribers;

create table if not exists subscribers (
  id                uuid primary key default gen_random_uuid(),
  list              text not null check (list in ('grail_plus', 'casa_de_copas')),
  email             text not null,
  name              text,
  zip               text,
  radius_miles      int  default 25,
  lang              text default 'es',
  source            text,                 -- 'checkout' | 'waitlist' | 'follow_promoter' | 'dove_load'
  opted_in_at       timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  unique (list, email)
);

create index if not exists subscribers_list_idx
  on subscribers(list, created_at desc) where unsubscribed_at is null;

alter table subscribers enable row level security;

drop policy if exists "Public inserts to subscribers" on subscribers;
create policy "Public inserts to subscribers"
  on subscribers for insert
  with check (true);

drop policy if exists "Admin reads subscribers" on subscribers;
create policy "Admin reads subscribers"
  on subscribers for select
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));

drop policy if exists "Admin updates subscribers" on subscribers;
create policy "Admin updates subscribers"
  on subscribers for update
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));
