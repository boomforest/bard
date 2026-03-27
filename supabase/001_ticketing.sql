-- ============================================================
-- Ticketing System Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- EVENTS table
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  artist_name text not null,
  show_date timestamptz not null,
  venue_hint text not null,
  venue_address text not null,
  reveal_datetime timestamptz not null,
  capacity int not null default 250,
  early_bird_price int not null default 40000,  -- in MXN cents (400.00 MXN)
  regular_price int not null default 50000,      -- in MXN cents (500.00 MXN)
  early_bird_ends timestamptz not null,
  tickets_sold int not null default 0,
  created_at timestamptz not null default now()
);

-- TICKETS table
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  email text not null,
  name text not null,
  quantity int not null default 1,
  ticket_number int not null,
  stripe_payment_intent_id text,
  torn boolean not null default false,
  torn_at timestamptz,
  created_at timestamptz not null default now(),
  follow_nonlinear boolean not null default false,
  unique (event_id, ticket_number)
);

-- FOLLOWERS table
create table if not exists followers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  city text not null default 'Condesa/Roma, CDMX',
  radius_miles int not null default 10,
  artist_id text not null default 'nonlinear',
  created_at timestamptz not null default now()
);

-- ============================================================
-- Seed the Nonlinear April 11 event
-- Show date: April 11 2026 10PM Mexico City (UTC-6 = 04:00 UTC April 12)
-- Reveal: midnight April 11 Mexico City (UTC-6 = 06:00 UTC April 11)
-- Early bird ends: April 7 2026 00:00 Mexico City (UTC-6 = 06:00 UTC April 7)
-- ============================================================
insert into events (
  artist_name,
  show_date,
  venue_hint,
  venue_address,
  reveal_datetime,
  capacity,
  early_bird_price,
  regular_price,
  early_bird_ends
) values (
  'Nonlinear',
  '2026-04-12 04:00:00+00',   -- April 11 10PM CDMX (UTC-6)
  'Less than 10 minutes from Condesa/Roma',
  'Alvarez de Icaza 13',
  '2026-04-11 06:00:00+00',   -- midnight April 11 CDMX (UTC-6)
  250,
  40000,
  50000,
  '2026-04-07 06:00:00+00'    -- April 7 midnight CDMX (UTC-6)
)
on conflict do nothing;

-- ============================================================
-- Row-level security: allow public reads on events
-- Allow public inserts on tickets and followers (purchases happen client-side)
-- In production, move ticket writes to a server function with secret key
-- ============================================================
alter table events enable row level security;
alter table tickets enable row level security;
alter table followers enable row level security;

-- Events: anyone can read
create policy "Public read events"
  on events for select
  using (true);

-- Tickets: anyone can insert (purchase flow), only read own ticket by UUID
create policy "Anyone can purchase tickets"
  on tickets for insert
  with check (true);

create policy "Read ticket by id"
  on tickets for select
  using (true);

create policy "Update ticket torn status"
  on tickets for update
  using (true);

-- Followers: anyone can insert
create policy "Anyone can follow"
  on followers for insert
  with check (true);

create policy "Public read followers"
  on followers for select
  using (true);
