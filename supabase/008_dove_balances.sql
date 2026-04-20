-- ============================================================
-- Doves: pre-loaded bar balances + leftover-refund mechanism
-- Run after 007_refunds.sql. Idempotent.
--
-- Each balance is tied to a single Stripe charge. Spending against the
-- balance happens server-side (spend-doves function) so we can guarantee
-- the spent_cents <= loaded_cents invariant. At end of night, the
-- close-out-bar function refunds (loaded_cents - spent_cents) for every
-- active balance.
-- ============================================================

create table if not exists dove_balances (
  id                       uuid primary key default gen_random_uuid(),
  event_id                 uuid not null references events(id) on delete cascade,
  token                    text not null unique,                 -- secret handed to the buyer's browser
  email                    text,
  customer_name            text,
  loaded_cents             int  not null,
  spent_cents              int  not null default 0,
  status                   text not null default 'active',       -- active | refunded | depleted
  stripe_payment_intent_id text not null,
  refund_id                text,
  refunded_amount_cents    int,
  refunded_at              timestamptz,
  refunded_by              uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists dove_balances_event_idx        on dove_balances(event_id);
create index if not exists dove_balances_token_idx        on dove_balances(token);
create index if not exists dove_balances_event_status_idx on dove_balances(event_id, status);

-- Track which balance paid each bar order (for analytics + reconciliation)
alter table bar_orders
  add column if not exists dove_balance_id uuid references dove_balances(id) on delete set null;

create index if not exists bar_orders_balance_idx on bar_orders(dove_balance_id);

-- Realtime so the EventBar UI can react to spend events from another device
alter publication supabase_realtime add table dove_balances;

-- ── RLS ──────────────────────────────────────────────────────
alter table dove_balances enable row level security;

-- Anyone can read by token (bar UI does this on load to verify balance).
-- The token itself is the access secret.
drop policy if exists "Public read dove_balances" on dove_balances;
create policy "Public read dove_balances"
  on dove_balances for select using (true);

-- Inserts and updates go through service-role functions only — no public
-- policies needed (the service role bypasses RLS).
