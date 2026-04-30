-- Promoter UPDATE/DELETE policies for child tables.
--
-- Migration 002 set up INSERT policies for ticket_tiers, event_producers,
-- and bar_menu_items, but no UPDATE or DELETE. That worked while every
-- event went insert-only (create flow). The unified create+edit flow
-- shipped 2026-04-30 uses upsert (= insert + update) and delete-and-replace
-- for producers, so the missing policies started returning:
--   "new row violates row-level security policy (USING expression)"
--
-- Idempotent — drop+create pattern.

-- ── ticket_tiers ────────────────────────────────────────────
drop policy if exists "Promoter updates ticket_tiers" on ticket_tiers;
create policy "Promoter updates ticket_tiers"
  on ticket_tiers for update
  using (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  )
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

-- ── event_producers (delete-and-replace strategy) ───────────
drop policy if exists "Promoter updates event_producers" on event_producers;
create policy "Promoter updates event_producers"
  on event_producers for update
  using (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  )
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

drop policy if exists "Promoter deletes event_producers" on event_producers;
create policy "Promoter deletes event_producers"
  on event_producers for delete
  using (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );

-- ── bar_menu_items (covers real edits + soft-delete via active=false) ─
drop policy if exists "Promoter updates bar_menu_items" on bar_menu_items;
create policy "Promoter updates bar_menu_items"
  on bar_menu_items for update
  using (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  )
  with check (
    exists (select 1 from events e where e.id = event_id and e.promoter_id = auth.uid())
  );
