-- Three competitor-parity ticketing features in one migration:
--   1. Promo / discount codes (per-event, %/$/override, max-uses, expiry)
--   2. Comp / guest-list tickets (free tickets minted directly by the promoter)
--   3. Source attribution (?ref=ig captured on the buyer's URL)
--
-- All three live on / next to `tickets`, so they ship together.
-- Idempotent — safe to re-run.

-- ── promo_codes ─────────────────────────────────────────────────────────────
create table if not exists promo_codes (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  code         text not null,
  -- 'percent'  → amount_cents is basis points (1000 = 10%)
  -- 'fixed'    → amount_cents is cents off the line price per ticket
  -- 'override' → amount_cents is the new per-ticket price
  kind         text not null check (kind in ('percent', 'fixed', 'override')),
  amount_cents int  not null default 0,
  max_uses     int,                  -- null = unlimited
  used_count   int  not null default 0,
  expires_at   timestamptz,          -- null = never
  tier_id      uuid references ticket_tiers(id) on delete cascade,  -- null = applies to any tier
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- One code string per event (case-insensitive).
create unique index if not exists promo_codes_event_code_idx
  on promo_codes(event_id, lower(code));

create index if not exists promo_codes_event_active_idx
  on promo_codes(event_id) where active = true;

alter table promo_codes enable row level security;

-- Promoters fully manage codes for their own events.
drop policy if exists "Promoter reads promo_codes" on promo_codes;
create policy "Promoter reads promo_codes"
  on promo_codes for select
  using (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

drop policy if exists "Promoter inserts promo_codes" on promo_codes;
create policy "Promoter inserts promo_codes"
  on promo_codes for insert
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

drop policy if exists "Promoter updates promo_codes" on promo_codes;
create policy "Promoter updates promo_codes"
  on promo_codes for update
  using (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  )
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

drop policy if exists "Promoter deletes promo_codes" on promo_codes;
create policy "Promoter deletes promo_codes"
  on promo_codes for delete
  using (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

-- Validation + redemption happen server-side via service-role functions
-- (create-payment-intent, finalize-ticket-purchase). Public buyers never
-- read promo_codes directly — they submit a code string and the server
-- decides whether it's valid.

-- ── tickets: attribution + comp + applied-promo columns ─────────────────────
alter table tickets add column if not exists source         text;
alter table tickets add column if not exists is_comp        boolean not null default false;
alter table tickets add column if not exists promo_code     text;
alter table tickets add column if not exists discount_cents int not null default 0;

-- Lookups for the promoter-side "Top sources" / promo redemption charts.
create index if not exists tickets_event_source_idx
  on tickets(event_id, source) where source is not null;

create index if not exists tickets_event_promo_idx
  on tickets(event_id, promo_code) where promo_code is not null;

-- RLS: promoters already read their own event tickets via existing policies.
-- Comp inserts come through the mint-comp-tickets Netlify fn (service role),
-- so no new public insert policy is needed.
