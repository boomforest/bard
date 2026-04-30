-- events.hidden — promoter-controlled visibility flag for the dashboard.
--
-- Default false (visible). Hidden events stay live at /e/{slug} and the
-- handle redirect — this is purely a dashboard organization feature so a
-- promoter can declutter without deleting historical records.
--
-- Idempotent.

alter table events
  add column if not exists hidden boolean not null default false;

-- The dashboard query filters by hidden=false; an index on the column
-- helps once a promoter accumulates a long history.
create index if not exists events_hidden_idx on events(hidden) where hidden = true;
