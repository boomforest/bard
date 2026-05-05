-- Aggregates every public table into a single JSONB object keyed by table name.
-- Called once a week by netlify/functions/weekly-backup.js, which forwards the
-- JSON to a private GitHub repo. Skips PostGIS system table (spatial_ref_sys)
-- since it's static reference data, not user data.

create or replace function public.backup_all_tables()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb := '{}'::jsonb;
  t text;
  table_rows jsonb;
begin
  for t in
    select tablename from pg_tables
     where schemaname = 'public'
       and tablename <> 'spatial_ref_sys'
     order by tablename
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x.*)), ''[]''::jsonb) from %I x', t)
      into table_rows;
    result := result || jsonb_build_object(t, table_rows);
  end loop;
  return result;
end;
$$;

revoke all on function public.backup_all_tables() from public, anon, authenticated;
grant  execute on function public.backup_all_tables() to service_role;
