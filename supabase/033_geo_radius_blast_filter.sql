-- Geo-aware blast filtering. Followers who signed up with a zip + radius
-- should only get blasts for events near them. This adds lat/lng on
-- events and recipients (denormalized from a zip_locations cache, so
-- distance math is a single SQL query at blast time, no HTTP calls).
--
-- Lazy backfill: existing rows have null lat/lng. The filter function
-- includes follower in the blast when either side has no coords —
-- "I don't know where you are" defaults to "let you decide whether to
-- come" (better to over-deliver than miss). Once the geocode-zip
-- function fills the columns, the filter starts narrowing.

alter table public.events
  add column if not exists venue_zip      text,
  add column if not exists venue_country  text default 'mx',
  add column if not exists venue_lat      double precision,
  add column if not exists venue_lng      double precision;

alter table public.promoter_followers
  add column if not exists country  text default 'mx',
  add column if not exists lat      double precision,
  add column if not exists lng      double precision;

alter table public.subscribers
  add column if not exists country  text default 'mx',
  add column if not exists lat      double precision,
  add column if not exists lng      double precision;

-- Cached zip → coords. Geocoded on first lookup via the geocode-zip
-- Netlify function and reused forever (zips don't move).
create table if not exists public.zip_locations (
  zip               text not null,
  country           text not null default 'mx',
  lat               double precision,
  lng               double precision,
  last_geocoded_at  timestamptz not null default now(),
  primary key (zip, country)
);

-- Service role manages this cache; readable by everyone for joins.
alter table public.zip_locations enable row level security;

drop policy if exists "Public read zip_locations" on public.zip_locations;
create policy "Public read zip_locations"
  on public.zip_locations for select using (true);

-- Haversine. Returns miles. Pure SQL so it inlines well in queries.
create or replace function public.geo_distance_miles(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe as $$
  select 3958.8 * 2 * asin(sqrt(
    pow(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    pow(sin(radians((lng2 - lng1) / 2)), 2)
  ))
$$;

-- Filter recipients for an event blast by their stated radius. Returns
-- the same shape send-new-event-notification.js expects:
--   id, email, name, lang
-- Filter logic per follower:
--   * if event has no venue_lat/lng → include
--   * if follower has no lat/lng → include (we don't know, give them the option)
--   * if follower.radius_miles is null/0 → include
--   * else: include only if distance <= radius_miles
create or replace function public.followers_in_event_radius(p_event_id uuid)
returns table (id uuid, email text, name text, lang text)
language sql stable security definer set search_path = public as $$
  with ev as (
    select promoter_id, venue_lat, venue_lng
    from events where id = p_event_id
  )
  select f.id, f.email, f.name, f.lang
  from promoter_followers f, ev
  where f.promoter_id = ev.promoter_id
    and (
      ev.venue_lat is null or ev.venue_lng is null   -- event location unknown -> blast all
      or f.lat is null or f.lng is null              -- follower location unknown -> blast
      or coalesce(f.radius_miles, 0) <= 0            -- no radius set -> blast
      or geo_distance_miles(ev.venue_lat, ev.venue_lng, f.lat, f.lng) <= f.radius_miles
    );
$$;

revoke all on function public.followers_in_event_radius(uuid) from public, anon;
grant  execute on function public.followers_in_event_radius(uuid) to authenticated, service_role;
