-- Artist profile fields — bio + avatar.
--
-- `avatar_url` is the public URL of an image uploaded to the existing
-- `profile-pictures` storage bucket (created via the Supabase dashboard).
-- Falls back to the initial-letter circle when null. Bio is a short
-- self-description shown on /a/<handle> and (eventually) in the promoter
-- Find Artists directory.

alter table public.users
  add column if not exists bio        text,
  add column if not exists avatar_url text;
