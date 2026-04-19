-- ============================================================
-- Multi-event platform migration
-- Adds promoter ownership, slugs, ticket tiers, and contract producers
-- to the existing events schema.
--
-- Run this in your Supabase SQL Editor AFTER 001_ticketing.sql.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

-- ─── EVENTS: extend with platform columns ────────────────────
alter table events
  add column if not exists name             text,
  add column if not exists slug             text,
  add column if not exists promoter_id      uuid references auth.users(id) on delete set null,
  add column if not exists doors_time       text,
  add column if not exists age_restriction  text,
  add column if not exists description      text,
  add column if not exists flyer_url        text,
  add column if not exists bar_enabled      boolean not null default true,
  add column if not exists active           boolean not null default true,
  add column if not exists status           text    not null default 'live';

-- Make slug unique (skip if index already exists)
create unique index if not exists events_slug_unique on events(slug);
create index        if not exists events_promoter_idx on events(promoter_id);

-- The existing 001_ticketing migration made artist_name / show_date / venue_hint
-- / venue_address / reveal_datetime / early_bird_ends NOT NULL. New events
-- coming through GrailSetup don't use those — relax them.
alter table events alter column artist_name     drop not null;
alter table events alter column show_date       drop not null;
alter table events alter column venue_hint      drop not null;
alter table events alter column venue_address   drop not null;
alter table events alter column reveal_datetime drop not null;
alter table events alter column early_bird_ends drop not null;

-- ─── TICKET TIERS ─────────────────────────────────────────────
create table if not exists ticket_tiers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  price_cents int  not null,
  qty         int  not null,
  sold        int  not null default 0,
  description text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ticket_tiers_event_idx on ticket_tiers(event_id);

-- ─── EVENT PRODUCERS (contract / splits) ──────────────────────
create table if not exists event_producers (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  name       text not null,
  role       text not null,
  split_pct  numeric(5,2) not null,
  signed     boolean not null default false,
  signed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists event_producers_event_idx on event_producers(event_id);

-- ─── BAR MENU ITEMS — ensure it exists (used by EventBar.jsx) ─
create table if not exists bar_menu_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  price_cents int  not null,
  emoji       text,
  category    text,
  description text,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists bar_menu_items_event_idx on bar_menu_items(event_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table ticket_tiers     enable row level security;
alter table event_producers  enable row level security;
alter table bar_menu_items   enable row level security;

-- Public reads for event surfaces
drop policy if exists "Public read ticket_tiers"    on ticket_tiers;
create policy "Public read ticket_tiers"    on ticket_tiers    for select using (true);

drop policy if exists "Public read event_producers" on event_producers;
create policy "Public read event_producers" on event_producers for select using (true);

drop policy if exists "Public read bar_menu_items"  on bar_menu_items;
create policy "Public read bar_menu_items"  on bar_menu_items  for select using (true);

-- Promoter writes — only the event owner can insert/update children
drop policy if exists "Promoter inserts events" on events;
create policy "Promoter inserts events"
  on events for insert
  with check (auth.uid() = promoter_id);

drop policy if exists "Promoter updates own events" on events;
create policy "Promoter updates own events"
  on events for update
  using (auth.uid() = promoter_id);

drop policy if exists "Promoter inserts ticket_tiers" on ticket_tiers;
create policy "Promoter inserts ticket_tiers"
  on ticket_tiers for insert
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

drop policy if exists "Promoter inserts event_producers" on event_producers;
create policy "Promoter inserts event_producers"
  on event_producers for insert
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

drop policy if exists "Promoter inserts bar_menu_items" on bar_menu_items;
create policy "Promoter inserts bar_menu_items"
  on bar_menu_items for insert
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

-- ─── STORAGE BUCKET FOR FLYERS ────────────────────────────────
-- Run in Storage section of Supabase, OR uncomment if your project
-- allows storage CRUD via SQL:
-- insert into storage.buckets (id, name, public) values ('flyers', 'flyers', true)
--   on conflict (id) do nothing;
