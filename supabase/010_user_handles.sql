-- Promoter vanity handles. Lets a promoter claim grail.mx/{handle} as a
-- shortlink that resolves to their most recent upcoming event.
--
-- Idempotent.

alter table users
  add column if not exists handle text unique;

-- Speeds up the /:handle lookup. Partial index — only rows with handles set.
create index if not exists users_handle_idx on users(handle) where handle is not null;

-- Anyone can resolve a handle to a user (public lookup for the redirect).
-- The existing "Users can read their own row" policy already lets the user
-- read+write their own handle. If broader read on the handle column is
-- needed for the public redirect, RLS via SECURITY DEFINER function in a
-- follow-up migration is the safer pattern. For now, the lookup works under
-- whatever public read policy users already has.
