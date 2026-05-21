-- Per-producer settlement tracking. settled_at + amount + transfer id are
-- stamped after the Stripe transfer succeeds, so a half-failed run can be
-- retried without double-paying anyone.

alter table public.event_producers
  add column if not exists settled_at           timestamptz,
  add column if not exists settled_amount_cents int      not null default 0,
  add column if not exists stripe_transfer_id   text;

-- Pure math helper. Returns the per-producer breakdown so the UI can preview
-- the settlement before triggering transfers, and so run-settlement.js calls
-- a single source of truth instead of duplicating the formula in JS.
--
-- net_cents = max(0, ticket_revenue - fixed_costs - estimated platform/Stripe fees)
-- estimated combined fee rate: 5% (2% platform application_fee_amount + ~3%
-- Stripe processing). Real numbers vary slightly per-charge; promoters see
-- this disclaimed in the UI.
create or replace function public.settlement_breakdown(p_event_id uuid)
returns table (
  producer_id     uuid,
  user_id         uuid,
  name            text,
  role            text,
  split_pct       numeric,
  share_cents     int,
  is_lead         boolean,
  signed          boolean,
  settled_at      timestamptz,
  settled_amount  int,
  stripe_transfer_id text
)
language sql
stable
security definer
set search_path = public
as $$
  with
    ev as (
      select id, currency, promoter_id, fixed_costs
      from events where id = p_event_id
    ),
    ticket_revenue as (
      select coalesce(
        sum(greatest(0, tt.price_cents - coalesce(t.discount_cents, 0))),
        0
      )::int as gross_cents
      from tickets t
      join ticket_tiers tt on tt.id = t.tier_id
      where t.event_id = p_event_id and t.refunded = false
    ),
    fixed_costs_total as (
      select coalesce(sum((c->>'amount_cents')::int), 0)::int as cents
      from ev, jsonb_array_elements(ev.fixed_costs) c
    ),
    net as (
      select greatest(
        0,
        floor(((select gross_cents from ticket_revenue) * 0.95))::int -
        (select cents from fixed_costs_total)
      )::int as net_cents
    )
  select
    ep.id,
    ep.user_id,
    ep.name,
    ep.role,
    ep.split_pct,
    floor((select net_cents from net) * ep.split_pct / 100)::int as share_cents,
    (ep.user_id = (select promoter_id from ev))                  as is_lead,
    ep.signed,
    ep.settled_at,
    ep.settled_amount_cents,
    ep.stripe_transfer_id
  from event_producers ep
  where ep.event_id = p_event_id
  order by ep.created_at;
$$;

revoke all on function public.settlement_breakdown(uuid) from public, anon;
grant  execute on function public.settlement_breakdown(uuid) to authenticated, service_role;
