-- MadMap migration 002
-- Adds: location enrichment + nullable constraints for SOS, a feedback table,
-- a screenshots storage bucket, and a points-only reward RPC.
-- Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- PART 1 / 2 / 10 — SOS reports: infer location, drop blocking NOT NULLs
-- ---------------------------------------------------------------------------
-- platform is no longer collected from the user (root cause of the failing
-- submission: a NOT NULL column with a CHECK that received no value).
alter table sos_reports alter column platform drop not null;
-- PIN is now inferred from GPS, so it must not block the insert.
alter table sos_reports alter column pin_code drop not null;

alter table sos_reports add column if not exists product   text;
alter table sos_reports add column if not exists flavour   text;
alter table sos_reports add column if not exists city      text;
alter table sos_reports add column if not exists state     text;
-- screenshot_url / location_lat / location_lng already exist.

-- SOS now awards 75 points by default.
alter table sos_reports alter column points_earned set default 75;

-- ---------------------------------------------------------------------------
-- PART 4 / 10 — Customer feedback
-- ---------------------------------------------------------------------------
create table if not exists feedback (
  id             uuid primary key default gen_random_uuid(),
  product        text,
  flavour        text,
  message        text not null,
  pin_code       text,
  city           text,
  state          text,
  location_lat   double precision,
  location_lng   double precision,
  customer_phone text references customers(phone),
  points_earned  integer not null default 50,
  created_at     timestamptz not null default now()
);
create index if not exists feedback_created_at_idx on feedback(created_at desc);

-- ---------------------------------------------------------------------------
-- PART 5 / 10 — Rewards: add points without touching scan/sos counters
-- ---------------------------------------------------------------------------
create or replace function award_points(p_phone text, p_points integer)
returns void language plpgsql as $$
begin
  insert into customers (phone, total_points)
  values (p_phone, p_points)
  on conflict (phone) do update set
    total_points = customers.total_points + excluded.total_points;
end;
$$;

-- ---------------------------------------------------------------------------
-- PART 2 / 10 — Screenshot evidence storage (public bucket + anon policies)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'screenshots anon upload') then
    create policy "screenshots anon upload" on storage.objects
      for insert to anon with check (bucket_id = 'screenshots');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'screenshots public read') then
    create policy "screenshots public read" on storage.objects
      for select to anon using (bucket_id = 'screenshots');
  end if;
end $$;
