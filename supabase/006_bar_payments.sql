-- ============================================================
-- Bar order payment fields
-- Run after 005_bar_orders.sql.
-- Idempotent.
-- ============================================================

alter table bar_orders
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at                  timestamptz,
  add column if not exists subtotal_cents           int,
  add column if not exists application_fee_cents    int;

create index if not exists bar_orders_pi_idx on bar_orders(stripe_payment_intent_id);
