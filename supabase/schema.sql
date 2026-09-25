-- ============================================================================
-- FitnessJourni — schema + seed
-- Run in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Idempotent AND self-correcting: safe to run again, and it migrates the accent
-- names from the first draft of this file if you already ran that.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- members
-- Target defaults come from Dillon's 12-week playbook. They are per-member and
-- editable, so Angel and Bradley are not locked to his numbers.
--
-- `accent` values are the eight categorical slots validated against this app's
-- dark chart surface (colourblind separation + contrast). Do not invent new ones
-- without re-running the palette validator.
-- ----------------------------------------------------------------------------
create table if not exists public.members (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  accent            text not null default 'blue',
  sort_order        integer not null default 0,
  target_calories   integer not null default 2500,
  target_protein    integer not null default 156,
  target_carbs      integer not null default 313,
  target_fat        integer not null default 69,
  target_steps      integer not null default 10000,  -- ring goal ("10k ideal")
  target_steps_min  integer not null default 8000,   -- floor marker ("8k minimum")
  target_water_ml   integer not null default 2500,
  created_at        timestamptz not null default now()
);

-- Bring an already-created table in line with the validated palette. Values are
-- migrated BEFORE the constraint goes back on, or the ALTER would reject them.
alter table public.members alter column accent set default 'blue';
alter table public.members drop constraint if exists members_accent_check;

update public.members set accent = 'blue'    where accent = 'lime';
update public.members set accent = 'orange'  where accent = 'sky';
update public.members set accent = 'aqua'    where accent = 'amber';
update public.members set accent = 'magenta' where accent = 'rose';
update public.members set accent = 'aqua'    where accent = 'teal';

alter table public.members add constraint members_accent_check
  check (accent in ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'));

-- The playbook's standard is 4 lifting sessions a week. Per-member so it can differ.
alter table public.members
  add column if not exists target_workouts_per_week integer not null default 4;

-- ----------------------------------------------------------------------------
-- daily_logs
-- One row per member per day. The unique constraint is what makes the quick-entry
-- form an upsert instead of piling up duplicate rows for the same day.
-- ----------------------------------------------------------------------------
create table if not exists public.daily_logs (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  log_date   date not null,
  steps      integer not null default 0 check (steps >= 0),
  water_ml   integer not null default 0 check (water_ml >= 0),
  calories   integer not null default 0 check (calories >= 0),
  protein_g  integer not null default 0 check (protein_g >= 0),
  carbs_g    integer not null default 0 check (carbs_g >= 0),
  fat_g      integer not null default 0 check (fat_g >= 0),
  updated_at timestamptz not null default now(),
  unique (member_id, log_date)
);

create index if not exists daily_logs_date_idx on public.daily_logs (log_date desc);

-- ----------------------------------------------------------------------------
-- sessions — a training slot the group agrees on: a day, a time, an activity.
-- ----------------------------------------------------------------------------
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  session_date date not null,
  session_time time not null,
  activity     text not null
                 check (activity in ('run', 'workout', 'swim', 'walk', 'cycle', 'other')),
  note         text,
  created_by   uuid references public.members (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists sessions_when_idx on public.sessions (session_date, session_time);

-- ----------------------------------------------------------------------------
-- workouts — one row per session done, so the tallies are just a count.
--
-- Deliberately NOT unique on (member_id, workout_date): a lift and a cardio
-- session on the same day are two workouts, and the playbook schedules both.
-- ----------------------------------------------------------------------------
create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete cascade,
  workout_date date not null,
  -- A session can hit several areas, so this is a list, not a single value.
  -- One row is still one workout, which keeps the tallies a plain count.
  focuses      text[] not null
                 check (
                   array_length(focuses, 1) between 1 and 7
                   and focuses <@ array['upper', 'legs', 'push', 'pull', 'full_body', 'cardio', 'other']::text[]
                 ),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists workouts_member_date_idx
  on public.workouts (member_id, workout_date desc);

create index if not exists workouts_date_idx on public.workouts (workout_date desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- The anon key is used ONLY from the Next.js server (deliberately not exposed as
-- NEXT_PUBLIC_), so the browser never talks to Supabase directly. These policies
-- are therefore permissive. If you later add login, tighten them to match
-- auth.uid() and the rest of the app keeps working unchanged.
-- ----------------------------------------------------------------------------
alter table public.members    enable row level security;
alter table public.daily_logs enable row level security;
alter table public.sessions   enable row level security;
alter table public.workouts   enable row level security;

drop policy if exists members_rw    on public.members;
drop policy if exists daily_logs_rw on public.daily_logs;
drop policy if exists sessions_rw   on public.sessions;
drop policy if exists workouts_rw   on public.workouts;

create policy members_rw    on public.members    for all to anon, authenticated using (true) with check (true);
create policy daily_logs_rw on public.daily_logs for all to anon, authenticated using (true) with check (true);
create policy sessions_rw   on public.sessions   for all to anon, authenticated using (true) with check (true);
create policy workouts_rw   on public.workouts   for all to anon, authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Seed the three of you. Re-running will not create duplicates.
-- ----------------------------------------------------------------------------
insert into public.members (name, accent, sort_order)
select v.name, v.accent, v.sort_order
from (values
  ('Dillon',  'blue',   0),
  ('Angel',   'orange', 1),
  ('Bradley', 'aqua',   2)
) as v (name, accent, sort_order)
where not exists (select 1 from public.members m where m.name = v.name);
