-- V1.5: bring bar revenue into the settlement math. Bar tabs are loaded
-- via Stripe Connect (transfer_data routes funds to the lead promoter
-- like ticket sales do); bar_tabs.spent_cents is what stayed with the
-- lead after close-out refunds. We deduct the same 5% combined fee
-- estimate as for tickets.
--
-- Replaces (not adds) the previous settlement_breakdown — same return
-- shape, same security, same call sites.

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
    bar_revenue as (
      -- spent_cents is what actually stayed with the lead after close-out
      -- refunds the unspent portion to buyers. Sum across all tabs for
      -- the event.
      select coalesce(sum(spent_cents), 0)::int as gross_cents
      from bar_tabs
      where event_id = p_event_id
    ),
    fixed_costs_total as (
      select coalesce(sum((c->>'amount_cents')::int), 0)::int as cents
      from ev, jsonb_array_elements(ev.fixed_costs) c
    ),
    net as (
      select greatest(
        0,
        floor(
          ((select gross_cents from ticket_revenue) +
           (select gross_cents from bar_revenue))
          * 0.95
        )::int -
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
