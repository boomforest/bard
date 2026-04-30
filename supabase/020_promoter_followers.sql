-- Promoter-level follow / "get updates from this promoter" subscriptions.
-- A buyer signs up on any of a promoter's event pages with email + zip
-- + radius; new events from that promoter trigger a blast to followers.
--
-- Idempotent.

create table if not exists promoter_followers (
  id            uuid primary key default gen_random_uuid(),
  promoter_id   uuid not null references users(id) on delete cascade,
  email         text not null,
  name          text,
  zip           text,
  radius_miles  int  default 25,
  lang          text default 'es',
  notified_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (promoter_id, email)
);

create index if not exists promoter_followers_promoter_idx
  on promoter_followers(promoter_id, created_at desc);

alter table promoter_followers enable row level security;

-- Public can sign up; reads + updates gated to the promoter who owns
-- the followers (so a promoter can see their own list but not other
-- promoters'). Same shape as event_waitlist policies.

drop policy if exists "Public inserts to promoter_followers" on promoter_followers;
create policy "Public inserts to promoter_followers"
  on promoter_followers for insert
  with check (true);

drop policy if exists "Promoter reads own followers" on promoter_followers;
create policy "Promoter reads own followers"
  on promoter_followers for select
  using (promoter_id = auth.uid());

drop policy if exists "Promoter updates own followers" on promoter_followers;
create policy "Promoter updates own followers"
  on promoter_followers for update
  using (promoter_id = auth.uid())
  with check (promoter_id = auth.uid());
