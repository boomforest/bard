-- Once events.greenlit_at is stamped, the contract is frozen. Any change to
-- fixed_costs or to a producer row's contract-defining fields (split_pct,
-- role, name, email, signed) is rejected by these triggers. Settlement-
-- only fields (settled_at, settled_amount_cents, stripe_transfer_id) and
-- the redeem flow (user_id, invite_token) stay writeable so the post-show
-- payout and any pending invite redemptions still work.
--
-- UI also hides the edit controls when greenlit; these triggers are the
-- defense-in-depth for service-role and any direct-DB writes.

create or replace function public.enforce_event_contract_lock()
returns trigger
language plpgsql
as $$
begin
  if old.greenlit_at is not null
     and new.fixed_costs is distinct from old.fixed_costs then
    raise exception 'Contract is greenlit — fixed_costs cannot change. Un-sign a producer to unlock.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_event_contract_lock on public.events;
create trigger trg_event_contract_lock
  before update of fixed_costs on public.events
  for each row
  execute function public.enforce_event_contract_lock();

create or replace function public.enforce_producer_contract_lock()
returns trigger
language plpgsql
as $$
declare
  v_greenlit timestamptz;
  v_event_id uuid;
begin
  v_event_id := coalesce(new.event_id, old.event_id);
  select greenlit_at into v_greenlit from events where id = v_event_id;

  if v_greenlit is null then
    return coalesce(new, old);  -- not greenlit, nothing to enforce
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Contract is greenlit — cannot add producers. Un-sign someone to unlock.';
  elsif tg_op = 'DELETE' then
    raise exception 'Contract is greenlit — cannot remove producers. Un-sign someone to unlock.';
  elsif tg_op = 'UPDATE' then
    -- Allow specific fields to change post-greenlight:
    --   user_id, invite_token  -> co-producer claim flow (redeem_co_invite)
    --   signed, signed_at      -> the *un-sign* path (which clears greenlit_at via the existing trigger and re-opens the contract)
    --   settled_at, settled_amount_cents, stripe_transfer_id -> settlement
    if new.name        is distinct from old.name        then raise exception 'Contract greenlit — name cannot change'; end if;
    if new.role        is distinct from old.role        then raise exception 'Contract greenlit — role cannot change'; end if;
    if new.split_pct   is distinct from old.split_pct   then raise exception 'Contract greenlit — split_pct cannot change'; end if;
    if new.email       is distinct from old.email       then raise exception 'Contract greenlit — email cannot change'; end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_producer_contract_lock on public.event_producers;
create trigger trg_producer_contract_lock
  before insert or update or delete on public.event_producers
  for each row
  execute function public.enforce_producer_contract_lock();
