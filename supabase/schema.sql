-- MadMap Database Schema
-- Run this in the Supabase SQL Editor to set up your database.

-- QR Codes table (one row per printed packet code)
create table if not exists qr_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  product_name text not null,
  is_redeemed boolean not null default false,
  first_scan  boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Customer profiles
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  total_points  integer not null default 0,
  total_scans   integer not null default 0,
  total_sos     integer not null default 0,
  created_at    timestamptz not null default now()
);

-- QR scan events
create table if not exists scans (
  id              uuid primary key default gen_random_uuid(),
  qr_code         text not null references qr_codes(code),
  pin_code        text not null,
  product_name    text not null,
  platform        text not null check (platform in ('blinkit','instamart','zepto','store')),
  rating          integer not null check (rating between 1 and 5),
  would_buy_again boolean not null default true,
  points_earned   integer not null default 50,
  customer_phone  text references customers(phone),
  created_at      timestamptz not null default now()
);

-- SOS demand reports (location is inferred from GPS; platform/pin are optional)
create table if not exists sos_reports (
  id              uuid primary key default gen_random_uuid(),
  pin_code        text,
  product_name    text not null,
  product         text,
  flavour         text,
  city            text,
  state           text,
  platform        text check (platform in ('blinkit','instamart','zepto','store')),
  points_earned   integer not null default 75,
  report_status   text not null default 'pending' check (report_status in ('pending', 'finalized')),
  screenshot_url  text,
  location_lat    double precision,
  location_lng    double precision,
  customer_phone  text references customers(phone),
  created_at      timestamptz not null default now()
);

-- Customer feedback (product feedback / feature requests)
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

-- Indexes for common queries
create index if not exists scans_pin_code_idx       on scans(pin_code);
create index if not exists scans_created_at_idx     on scans(created_at desc);
create index if not exists sos_pin_code_idx         on sos_reports(pin_code);
create index if not exists sos_created_at_idx       on sos_reports(created_at desc);
create index if not exists feedback_created_at_idx  on feedback(created_at desc);
create index if not exists customers_phone_idx      on customers(phone);

-- RPC: upsert customer and add points
create or replace function add_customer_points(
  p_phone text,
  p_points integer,
  p_scan boolean
)
returns void
language plpgsql
as $$
begin
  insert into customers (phone, total_points, total_scans, total_sos)
  values (
    p_phone,
    p_points,
    case when p_scan then 1 else 0 end,
    case when p_scan then 0 else 1 end
  )
  on conflict (phone) do update set
    total_points = customers.total_points + excluded.total_points,
    total_scans  = customers.total_scans  + case when p_scan then 1 else 0 end,
    total_sos    = customers.total_sos    + case when p_scan then 0 else 1 end;
end;
$$;

-- RPC: add points only (used by SOS / feedback / referral rewards)
create or replace function award_points(p_phone text, p_points integer)
returns void language plpgsql as $$
begin
  insert into customers (phone, total_points)
  values (p_phone, p_points)
  on conflict (phone) do update set
    total_points = customers.total_points + excluded.total_points;
end;
$$;

-- Screenshot evidence storage (public bucket). Policies live in migration_002.sql.
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

-- Row-level security (enable for production)
-- alter table qr_codes   enable row level security;
-- alter table customers  enable row level security;
-- alter table scans      enable row level security;
-- alter table sos_reports enable row level security;

-- Sample QR codes for testing
insert into qr_codes (code, product_name) values
  ('demo-qr-001', 'MadMix Original'),
  ('demo-qr-002', 'MadMix Masala'),
  ('demo-qr-003', 'MadMix Peri Peri'),
  ('demo-qr-004', 'MadMix Cheese'),
  ('demo-qr-005', 'MadMix Tangy Tomato')
on conflict (code) do nothing;
