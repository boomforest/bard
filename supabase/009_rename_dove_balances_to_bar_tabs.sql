-- Rename dove_balances → bar_tabs.
--
-- Purpose: eliminate the naming collision with profiles.dov_balance
-- (the Casa de Copas Palomas wallet). bar_tabs is the per-event
-- prepaid bar credit ledger; profiles.dov_balance is a per-user
-- shared-economy column owned by Casa de Copas. Two ledgers, no
-- crossover. The schema-level distinction makes that obvious.
--
-- Idempotent: only renames if dove_balances still exists. Foreign keys,
-- indexes, and RLS policies follow the table automatically.

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'dove_balances') then
    alter table dove_balances rename to bar_tabs;
  end if;
end $$;

-- The bar_orders.dove_balance_id column still references bar_tabs(id) — the
-- rename doesn't break anything, but the column name is now stale. Optional
-- follow-up (not required for MVP) — uncomment to rename:
--
-- alter table bar_orders rename column dove_balance_id to bar_tab_id;
