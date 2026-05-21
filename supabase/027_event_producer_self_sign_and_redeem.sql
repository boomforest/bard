-- Co-producers need to (a) update their own row to set signed=true on
-- Greenlight, and (b) claim their event_producers row via invite_token at
-- signup time. Migration 026 added the columns; this migration wires the
-- access patterns through RLS + a security-definer redeem function.

-- (a) Producer can update their own row. Limited to their own row by both
-- USING and WITH CHECK so they can't reassign themselves.
drop policy if exists "Producer updates own row" on public.event_producers;
create policy "Producer updates own row"
  on public.event_producers
  for update
  using       (user_id is not null and user_id = auth.uid())
  with check  (user_id is not null and user_id = auth.uid());

-- (b) redeem_co_invite(token) — called from JoinPage right after signup.
-- Atomically links the event_producers row to the calling user and clears
-- the invite_token so it can't be reused. SECURITY DEFINER so it bypasses
-- the standard "Promoter updates" policy without needing the calling user
-- to be the event's promoter (they're a co-producer, not the promoter).
create or replace function public.redeem_co_invite(p_token text)
returns table (
  producer_id  uuid,
  event_id     uuid,
  event_slug   text,
  event_name   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid;
  v_eid uuid;
begin
  if v_uid is null then
    raise exception 'must be logged in';
  end if;

  update event_producers
     set user_id      = v_uid,
         invite_token = null
   where invite_token = p_token
     and user_id      is null
  returning id, event_id into v_pid, v_eid;

  if v_pid is null then
    raise exception 'invalid or already-used invite';
  end if;

  return query
    select v_pid, v_eid, e.slug, e.name
      from events e
     where e.id = v_eid;
end;
$$;

revoke all on function public.redeem_co_invite(text) from public, anon;
grant  execute on function public.redeem_co_invite(text) to authenticated, service_role;
