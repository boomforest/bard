-- Multi-producer contracts: each event has fixed_costs (DJ/venue/sound/etc.),
-- multiple producers with split percentages, and per-producer greenlight
-- signing. greenlit_at marks when the last producer signed; settled_at is
-- reserved for Sprint 2 (post-show payout).

alter table events
  add column if not exists fixed_costs  jsonb       not null default '[]'::jsonb,
  add column if not exists greenlit_at  timestamptz,
  add column if not exists settled_at   timestamptz;

-- Co-producers may not have a GRAIL account yet at invite time. user_id is
-- set when they sign up via the invite_token. email + invite_token mirror
-- the promoter_invites pattern (see migration 004) so the same email plumbing
-- applies.
alter table event_producers
  add column if not exists user_id       uuid references public.profiles(id) on delete set null,
  add column if not exists email         text,
  add column if not exists invite_token  text;

create unique index if not exists event_producers_invite_token_idx
  on event_producers(invite_token) where invite_token is not null;

-- Helper trigger: stamp events.greenlit_at when the last producer signs.
create or replace function public.update_event_greenlit_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unsigned int;
begin
  select count(*) into v_unsigned
    from event_producers
   where event_id = new.event_id and signed = false;

  if v_unsigned = 0 then
    update events set greenlit_at = now() where id = new.event_id and greenlit_at is null;
  else
    -- if a producer was un-signed (we don't expose this UI but be defensive),
    -- clear greenlit_at so the lock state is accurate.
    update events set greenlit_at = null where id = new.event_id and greenlit_at is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_event_producers_greenlit on event_producers;
create trigger trg_event_producers_greenlit
  after insert or update of signed on event_producers
  for each row
  execute function public.update_event_greenlit_at();
