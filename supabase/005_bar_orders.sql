-- ============================================================
-- Live bar orders
-- Run in Supabase SQL Editor after 004_admin_invites.sql.
-- Idempotent.
-- ============================================================

create table if not exists bar_orders (
  id            text primary key,                  -- short order id (e.g. "B7"), generated client-side
  event_id      uuid not null references events(id) on delete cascade,
  customer_name text not null,
  items         jsonb not null,                    -- [{id, name, emoji, price, qty}]
  total         numeric not null default 0,        -- in display currency (e.g. dollars)
  status        text not null default 'pending',   -- pending | preparing | ready | done
  ticket_id     uuid references tickets(id) on delete set null,  -- optional: which ticket placed it
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists bar_orders_event_status_idx on bar_orders(event_id, status, created_at);
create index if not exists bar_orders_event_idx        on bar_orders(event_id, created_at desc);

-- Enable realtime broadcasts so EventBar's subscription picks up inserts/updates
alter publication supabase_realtime add table bar_orders;

-- ── RLS ──────────────────────────────────────────────────────
alter table bar_orders enable row level security;

-- Anyone can place an order (customer side, no auth)
drop policy if exists "Anyone places bar orders" on bar_orders;
create policy "Anyone places bar orders"
  on bar_orders for insert with check (true);

-- Anyone can read (staff queue uses anon access via the secret slug URL).
-- The PIN gate in EventBar guards staff-only actions.
drop policy if exists "Public read bar orders" on bar_orders;
create policy "Public read bar orders"
  on bar_orders for select using (true);

-- Anyone can update status — also guarded by the staff PIN in the UI.
-- If you want hard server-side enforcement, swap this for an auth check
-- once a real promoter-side bartender login is in place.
drop policy if exists "Update bar order status" on bar_orders;
create policy "Update bar order status"
  on bar_orders for update using (true);
