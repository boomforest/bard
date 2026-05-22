-- Artist directory — opt-in flag for promoter discoverability.
--
-- Per the Artist TOS Module §[Y].5(a), artist accounts are private by
-- default. Setting open_to_bookings = true lists the artist in the
-- promoter-facing "Find Artists" directory (sorted by follower count).
-- Toggling off removes them immediately.
--
-- This is the only signal that gates directory visibility. Follower
-- counts come from a left join on artist_followers at query time.

alter table public.users
  add column if not exists open_to_bookings boolean not null default false;

create index if not exists users_open_to_bookings_idx
  on public.users(open_to_bookings)
  where open_to_bookings = true;
