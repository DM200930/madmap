-- MadMap migration 004
-- Enable Supabase Realtime for the admin dashboard so new SOS reports and
-- feedback appear live (the dashboard also refetches on refresh regardless).
-- Safe to run multiple times.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sos_reports'
  ) then
    alter publication supabase_realtime add table sos_reports;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback'
  ) then
    alter publication supabase_realtime add table feedback;
  end if;
end $$;
