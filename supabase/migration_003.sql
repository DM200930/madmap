-- MadMap migration 003
-- Adds restock-notification tracking to SOS reports and switches customer
-- feedback from free text to a 1–5 star rating.
-- Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- Restock Recovery — track who is waiting and who has been notified
-- ---------------------------------------------------------------------------
alter table sos_reports add column if not exists notified     boolean not null default false;
alter table sos_reports add column if not exists restocked_at timestamptz;
create index if not exists sos_notified_idx on sos_reports(notified);

-- ---------------------------------------------------------------------------
-- Feedback — star rating instead of free-text message
-- ---------------------------------------------------------------------------
alter table feedback add column if not exists rating integer check (rating between 1 and 5);
-- message is no longer collected from the UI; keep the column but allow nulls.
alter table feedback alter column message drop not null;
