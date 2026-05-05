alter table public.event_producers
  add column if not exists last_reminded_at timestamptz;
