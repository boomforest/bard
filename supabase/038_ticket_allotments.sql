-- Ticket allotments — artist paid in tickets instead of (or in addition
-- to) cash. The promoter sets ticket_allotment when adding the artist to
-- the lineup. The artist can then:
--   1. Comp some/all of them as guest-list (via mint-comp-tickets,
--      authed as the artist's user account, sets source='artist:<id>')
--   2. Sell some/all via their affiliate link (?ref=artist:<id> — already
--      attributes via tickets.source on the existing flow)
--
-- The remaining-count query is:
--   ticket_allotment
--   - count(tickets where source='artist:<producer_id>' and not refunded)
--
-- That count includes both comps and sales — both consume the allotment.
-- This intentionally caps how many tickets an artist can move under
-- their booking, even if they share their affiliate link widely.

alter table public.event_producers
  add column if not exists ticket_allotment int not null default 0;
