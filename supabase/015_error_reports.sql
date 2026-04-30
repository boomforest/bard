-- Error inbox — every unhandled exception in the app posts a row here so
-- JP (and any other admin) can see what's broken in production without
-- needing to spelunk Netlify function logs.
--
-- Idempotent.

create table if not exists error_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  user_email   text,
  message      text,
  stack        text,
  url          text,
  user_agent   text,
  context      jsonb,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists error_reports_unresolved_idx
  on error_reports(created_at desc)
  where resolved = false;

alter table error_reports enable row level security;

-- Admins read everything
drop policy if exists "Admin reads error_reports" on error_reports;
create policy "Admin reads error_reports"
  on error_reports for select
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));

-- Admins can mark resolved
drop policy if exists "Admin updates error_reports" on error_reports;
create policy "Admin updates error_reports"
  on error_reports for update
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));

-- All inserts go through the service role via /.netlify/functions/report-error.
-- (No public insert policy, so anon clients can't spam the table directly.)
