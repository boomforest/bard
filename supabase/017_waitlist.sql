-- Waitlist for sold-out events. Buyers can sign up to be notified if
-- a ticket frees up (refund or capacity bump).
--
-- Idempotent.

create table if not exists event_waitlist (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  email       text not null,
  name        text,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (event_id, email)
);

create index if not exists event_waitlist_event_idx
  on event_waitlist(event_id, created_at desc);

alter table event_waitlist enable row level security;

-- Anyone can sign up to a public event waitlist (and read the count
-- via a separate view/query if we want to display it). To keep things
-- simple now, we proxy reads + writes through Netlify functions and
-- only allow promoter-of-the-event to read the full list directly.

drop policy if exists "Public inserts to waitlist" on event_waitlist;
create policy "Public inserts to waitlist"
  on event_waitlist for insert
  with check (true);

drop policy if exists "Promoter reads own waitlist" on event_waitlist;
create policy "Promoter reads own waitlist"
  on event_waitlist for select
  using (exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid()));

drop policy if exists "Promoter updates own waitlist" on event_waitlist;
create policy "Promoter updates own waitlist"
  on event_waitlist for update
  using (exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid()));
