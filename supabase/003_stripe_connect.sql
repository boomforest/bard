-- ============================================================
-- Stripe Connect: store promoter's connected account on users.
-- Run in Supabase SQL Editor after 002_multi_event.sql.
-- Idempotent.
-- ============================================================

alter table users
  add column if not exists stripe_account_id   text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false;

create index if not exists users_stripe_account_idx on users(stripe_account_id);

-- Tickets: track which tier was purchased so promoter dashboards can
-- show breakdowns (and so the door scanner can show "VIP" vs "GA").
alter table tickets
  add column if not exists tier_id   uuid references ticket_tiers(id) on delete set null,
  add column if not exists tier_name text;
create index if not exists tickets_tier_idx on tickets(tier_id);
