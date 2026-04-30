-- Platform-level "tell me about Grail exclusive + secret events" list.
-- Collected via opt-in checkbox on any buyer form (checkout, waitlist,
-- promoter follow, dove load). One row per email; subsequent opt-ins
-- (e.g. same buyer at a different event) refresh `last_opted_in_at`
-- and `source` so we can trace the latest acquisition channel.
--
-- Idempotent.

create table if not exists grail_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  name              text,
  lang              text default 'es',
  source            text,                 -- 'checkout' | 'waitlist' | 'follow_promoter' | 'dove_load'
  opted_in_at       timestamptz not null default now(),
  last_opted_in_at  timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists grail_subscribers_lang_idx
  on grail_subscribers(lang) where unsubscribed_at is null;

alter table grail_subscribers enable row level security;

-- Public can opt in. Reads/updates locked to admin (will use service
-- role from the future blast function). No promoter-level access since
-- this is a platform list, not per-promoter.

drop policy if exists "Public inserts to grail_subscribers" on grail_subscribers;
create policy "Public inserts to grail_subscribers"
  on grail_subscribers for insert
  with check (true);

drop policy if exists "Admin reads grail_subscribers" on grail_subscribers;
create policy "Admin reads grail_subscribers"
  on grail_subscribers for select
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));
