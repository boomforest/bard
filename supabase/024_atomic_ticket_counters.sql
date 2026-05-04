-- Atomic counter increments for ticket_tiers.sold and events.tickets_sold.
-- Replaces the read-modify-write pattern in finalize-ticket-purchase.js and
-- mint-comp-tickets.js, which left tier.sold inflated when a ticket insert
-- failed mid-loop or when two callers raced.
--
-- delta can be negative (used by refund-ticket / delete-ticket paths if they
-- migrate to the same RPC).

create or replace function public.bump_tier_sold(p_tier_id uuid, p_delta int)
returns int
language sql
security definer
set search_path = public
as $$
  update ticket_tiers
     set sold = greatest(0, coalesce(sold, 0) + p_delta)
   where id = p_tier_id
  returning sold;
$$;

create or replace function public.bump_event_tickets_sold(p_event_id uuid, p_delta int)
returns int
language sql
security definer
set search_path = public
as $$
  update events
     set tickets_sold = greatest(0, coalesce(tickets_sold, 0) + p_delta)
   where id = p_event_id
  returning tickets_sold;
$$;

-- Service role uses these via .rpc(); deny anon/authenticated to keep callers
-- routed through the Netlify functions (which already enforce ownership).
revoke all on function public.bump_tier_sold(uuid, int)        from public, anon, authenticated;
revoke all on function public.bump_event_tickets_sold(uuid, int) from public, anon, authenticated;
grant  execute on function public.bump_tier_sold(uuid, int)        to service_role;
grant  execute on function public.bump_event_tickets_sold(uuid, int) to service_role;
