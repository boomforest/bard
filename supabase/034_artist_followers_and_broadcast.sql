-- Artist accounts MVP: followers, geo-radius blast, and per-show / global
-- broadcast controls. Mirrors the promoter_followers + 033 geo-filter
-- pattern but scoped to artists (users.user_type = 'artist').
--
-- Auto-broadcast contract — when an event_producers row with role = 'Artist'
-- transitions to signed = true, send-artist-greenlight-notification.js:
--   1. confirms users.broadcast_default = true for the artist
--   2. confirms event_producers.broadcast_disabled = false for this row
--   3. confirms last_broadcast_at is null (don't re-blast on un-sign cycles)
--   4. fans out via artist_followers_in_event_radius RPC
--   5. stamps last_broadcast_at on the producer row
--
-- The 030 contract-lock trigger doesn't block the new columns —
-- broadcast_disabled and last_broadcast_at are operationally mutable
-- post-greenlight by design (artist needs to be able to opt out of
-- broadcast even after signing the contract).

-- ─── Followers table ───────────────────────────────────────────────────────

create table if not exists artist_followers (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references users(id) on delete cascade,
  email         text not null,
  name          text,
  zip           text,
  radius_miles  int  default 25,
  lang          text default 'es',
  country       text default 'mx',
  lat           double precision,
  lng           double precision,
  notified_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (artist_id, email)
);

create index if not exists artist_followers_artist_idx
  on artist_followers(artist_id, created_at desc);

alter table artist_followers enable row level security;

drop policy if exists "Public inserts to artist_followers" on artist_followers;
create policy "Public inserts to artist_followers"
  on artist_followers for insert
  with check (true);

drop policy if exists "Artist reads own followers" on artist_followers;
create policy "Artist reads own followers"
  on artist_followers for select
  using (artist_id = auth.uid());

drop policy if exists "Artist updates own followers" on artist_followers;
create policy "Artist updates own followers"
  on artist_followers for update
  using (artist_id = auth.uid())
  with check (artist_id = auth.uid());

-- Public unfollow (no extra auth friction for opt-out).
drop policy if exists "Public deletes from artist_followers" on artist_followers;
create policy "Public deletes from artist_followers"
  on artist_followers for delete
  using (true);

-- ─── Broadcast controls ────────────────────────────────────────────────────

-- Artist's global default. True = signed lineup adds auto-blast to followers.
-- False = artist must explicitly opt-in per show (post-MVP UI).
alter table users
  add column if not exists broadcast_default boolean not null default true;

-- Per-show opt-out by the artist. Set via the toggle next to Greenlight.
-- Stays mutable post-greenlight; not on 030's contract-lock block list.
alter table event_producers
  add column if not exists broadcast_disabled boolean not null default false;

-- Stamped by send-artist-greenlight-notification after a successful blast.
-- Prevents re-broadcasts on un-sign / re-sign cycles. MVP has no admin
-- path to reset this; a future "blast this again" feature would clear it.
alter table event_producers
  add column if not exists last_broadcast_at timestamptz;

-- ─── RPC: artist's followers within event radius ───────────────────────────

-- Same shape as public.followers_in_event_radius but filtered to one
-- specific artist's followers (so a multi-artist lineup blast loops the
-- function per artist; each artist's followers get exactly one email).
create or replace function public.artist_followers_in_event_radius(
  p_event_id  uuid,
  p_artist_id uuid
) returns table (id uuid, email text, name text, lang text)
language sql stable security definer set search_path = public as $$
  with ev as (
    select venue_lat, venue_lng
    from events where id = p_event_id
  )
  select f.id, f.email, f.name, f.lang
  from artist_followers f, ev
  where f.artist_id = p_artist_id
    and (
      ev.venue_lat is null or ev.venue_lng is null  -- event location unknown -> blast all
      or f.lat is null or f.lng is null             -- follower location unknown -> blast
      or coalesce(f.radius_miles, 0) <= 0           -- no radius set -> blast
      or geo_distance_miles(ev.venue_lat, ev.venue_lng, f.lat, f.lng) <= f.radius_miles
    );
$$;

revoke all on function public.artist_followers_in_event_radius(uuid, uuid) from public, anon;
grant  execute on function public.artist_followers_in_event_radius(uuid, uuid) to authenticated, service_role;
