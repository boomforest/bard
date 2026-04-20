-- ============================================================
-- Refund tracking on tickets + bar_orders.
-- Run after 006_bar_payments.sql. Idempotent.
-- ============================================================

alter table tickets
  add column if not exists refunded     boolean not null default false,
  add column if not exists refunded_at  timestamptz,
  add column if not exists refund_id    text,
  add column if not exists refunded_by  uuid references auth.users(id) on delete set null;

create index if not exists tickets_refunded_idx on tickets(event_id, refunded);

alter table bar_orders
  add column if not exists refunded     boolean not null default false,
  add column if not exists refunded_at  timestamptz,
  add column if not exists refund_id    text,
  add column if not exists refunded_by  uuid references auth.users(id) on delete set null;

create index if not exists bar_orders_refunded_idx on bar_orders(event_id, refunded);
