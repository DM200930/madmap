-- MadMap migration 003
-- Adds restock-notification tracking to SOS reports and the star-rating
-- feedback schema. Fully idempotent and self-contained: it guarantees every
-- column the frontend inserts exists, then reloads the PostgREST schema cache
-- so inserts don't fail with "Could not find the 'rating' column ... in the
-- schema cache" (PGRST204). Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- Restock Recovery — track who is waiting and who has been notified
-- ---------------------------------------------------------------------------
alter table sos_reports add column if not exists notified     boolean not null default false;
alter table sos_reports add column if not exists restocked_at timestamptz;
create index if not exists sos_notified_idx on sos_reports(notified);

-- ---------------------------------------------------------------------------
-- Feedback — ensure the table and EVERY inserted column exists
-- ---------------------------------------------------------------------------
create table if not exists feedback (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now()
);

-- Add each field the frontend submits (idempotent; covers partially-migrated DBs)
alter table feedback add column if not exists product        text;
alter table feedback add column if not exists flavour        text;
alter table feedback add column if not exists rating         integer;
alter table feedback add column if not exists message        text;
alter table feedback add column if not exists pin_code       text;
alter table feedback add column if not exists city           text;
alter table feedback add column if not exists state          text;
alter table feedback add column if not exists location_lat   double precision;
alter table feedback add column if not exists location_lng   double precision;
alter table feedback add column if not exists customer_phone text;
alter table feedback add column if not exists points_earned  integer not null default 50;

-- rating must be 1–5; message is no longer required
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'feedback' and constraint_name = 'feedback_rating_check'
  ) then
    alter table feedback add constraint feedback_rating_check check (rating between 1 and 5);
  end if;
end $$;

alter table feedback alter column message drop not null;

create index if not exists feedback_created_at_idx on feedback(created_at desc);

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache so the new columns are immediately usable
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
