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
-- `accent` values are the twelve categorical slots used against this app's
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
  target_sleep_hours numeric(4, 2) not null default 8,
  created_at        timestamptz not null default now()
);

-- Bring an already-created table in line with the validated palette. Values are
-- migrated BEFORE the constraint goes back on, or the ALTER would reject them.
alter table public.members alter column accent set default 'blue';
alter table public.members drop constraint if exists members_accent_check;

update public.members set accent = 'orange'  where accent = 'sky';
update public.members set accent = 'aqua'    where accent = 'amber';
update public.members set accent = 'magenta' where accent = 'rose';
update public.members set accent = 'aqua'    where accent = 'teal';

alter table public.members add constraint members_accent_check
  check (accent in (
    'blue', 'orange', 'aqua', 'yellow', 'magenta', 'green',
    'violet', 'red', 'cyan', 'lime', 'pink', 'silver'
  ));

-- The playbook's standard is 4 lifting sessions a week. Per-member so it can differ.
alter table public.members
  add column if not exists target_workouts_per_week integer not null default 4,
  add column if not exists target_sleep_hours numeric(4, 2) not null default 8;

alter table public.members drop constraint if exists members_target_sleep_hours_check;
alter table public.members add constraint members_target_sleep_hours_check
  check (target_sleep_hours between 1 and 24);

alter table public.members
  add column if not exists age integer,
  add column if not exists height_cm numeric(5, 2),
  add column if not exists target_weight_kg numeric(5, 2),
  add column if not exists target_bmi numeric(4, 1),
  add column if not exists avatar_path text,
  add column if not exists surname text;

alter table public.members drop constraint if exists members_name_length_check;
alter table public.members add constraint members_name_length_check
  check (char_length(trim(name)) between 1 and 50);
alter table public.members drop constraint if exists members_surname_length_check;
alter table public.members add constraint members_surname_length_check
  check (surname is null or char_length(trim(surname)) between 1 and 50);

alter table public.members drop constraint if exists members_age_check;
alter table public.members add constraint members_age_check
  check (age is null or age between 13 and 120);
alter table public.members drop constraint if exists members_height_cm_check;
alter table public.members add constraint members_height_cm_check
  check (height_cm is null or height_cm between 100 and 250);
alter table public.members drop constraint if exists members_target_weight_kg_check;
alter table public.members add constraint members_target_weight_kg_check
  check (target_weight_kg is null or target_weight_kg between 25 and 500);
alter table public.members drop constraint if exists members_target_bmi_check;
alter table public.members add constraint members_target_bmi_check
  check (target_bmi is null or target_bmi between 10 and 60);

-- Login details live separately from public profile data. Existing member rows
-- remain valid without credentials until their owner claims the account.
create table if not exists public.member_credentials (
  member_id     uuid primary key references public.members (id) on delete cascade,
  username      text not null,
  email         text not null,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (username = lower(username)),
  check (char_length(username) between 3 and 30),
  check (username ~ '^[a-z0-9][a-z0-9._-]+$'),
  check (email = lower(email)),
  check (char_length(email) between 5 and 254)
);

create unique index if not exists member_credentials_username_idx
  on public.member_credentials (lower(username));
create unique index if not exists member_credentials_email_idx
  on public.member_credentials (lower(email));

create table if not exists public.member_links (
  member_id        uuid not null references public.members (id) on delete cascade,
  linked_member_id uuid not null references public.members (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (member_id, linked_member_id),
  check (member_id <> linked_member_id)
);

create table if not exists public.weight_measurements (
  member_id   uuid not null references public.members (id) on delete cascade,
  month_start date not null,
  measured_on date,
  weight_kg   numeric(5, 2) not null check (weight_kg between 25 and 500),
  updated_at  timestamptz not null default now(),
  primary key (member_id, month_start),
  check (month_start = date_trunc('month', month_start)::date)
);

alter table public.weight_measurements
  add column if not exists measured_on date;
update public.weight_measurements
  set measured_on = month_start
  where measured_on is null;
alter table public.weight_measurements
  alter column measured_on set not null;
alter table public.weight_measurements
  drop constraint if exists weight_measurements_pkey;
alter table public.weight_measurements
  add primary key (member_id, measured_on);

create index if not exists weight_measurements_date_idx
  on public.weight_measurements (member_id, measured_on desc);

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
  sleep_hours numeric(4, 2),
  updated_at timestamptz not null default now(),
  unique (member_id, log_date)
);

alter table public.daily_logs add column if not exists sleep_hours numeric(4, 2);
alter table public.daily_logs drop constraint if exists daily_logs_sleep_hours_check;
alter table public.daily_logs add constraint daily_logs_sleep_hours_check
  check (sleep_hours is null or sleep_hours between 0 and 24);

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

create table if not exists public.session_rsvps (
  session_id uuid not null references public.sessions (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  status     text not null check (status in ('going', 'not_going')),
  updated_at timestamptz not null default now(),
  primary key (session_id, member_id)
);

create table if not exists public.session_reads (
  member_id    uuid primary key references public.members (id) on delete cascade,
  last_read_at timestamptz not null default now()
);

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
-- runs — one group run with a normalized list of members who attended.
-- Pace is derived from duration and distance so the three figures cannot drift.
-- ----------------------------------------------------------------------------
create table if not exists public.runs (
  id               uuid primary key default gen_random_uuid(),
  run_date         date not null,
  duration_minutes numeric(6, 1) not null check (duration_minutes > 0 and duration_minutes <= 1440),
  distance_km      numeric(6, 2) not null check (distance_km > 0 and distance_km <= 1000),
  pace_seconds_per_km integer check (pace_seconds_per_km > 0 and pace_seconds_per_km <= 7200),
  created_by       uuid references public.members (id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.runs
  add column if not exists pace_seconds_per_km integer;

alter table public.runs drop constraint if exists runs_duration_minutes_check;
alter table public.runs alter column duration_minutes type numeric(6, 1)
  using duration_minutes::numeric(6, 1);
alter table public.runs add constraint runs_duration_minutes_check
  check (duration_minutes > 0 and duration_minutes <= 1440);

alter table public.runs drop constraint if exists runs_pace_seconds_per_km_check;
alter table public.runs add constraint runs_pace_seconds_per_km_check
  check (pace_seconds_per_km is null or pace_seconds_per_km between 1 and 7200);

create table if not exists public.run_attendees (
  run_id    uuid not null references public.runs (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  primary key (run_id, member_id)
);

create index if not exists runs_date_idx on public.runs (run_date desc);
create index if not exists run_attendees_member_idx on public.run_attendees (member_id);

-- ----------------------------------------------------------------------------
-- messages — short posts shared with the group. Each member keeps one read
-- cursor, which is enough to decide whether the navigation needs a new-post dot.
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 500),
  reply_to_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_reply_to_idx on public.messages (reply_to_id);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  reaction   text not null check (reaction in ('heart', 'thumbs_up', 'thumbs_down', 'smile', 'shocked', 'angry')),
  created_at timestamptz not null default now(),
  primary key (message_id, member_id)
);

alter table public.message_reactions drop constraint if exists message_reactions_reaction_check;
alter table public.message_reactions add constraint message_reactions_reaction_check
  check (reaction in ('heart', 'thumbs_up', 'thumbs_down', 'smile', 'shocked', 'angry'));

create index if not exists message_reactions_member_idx
  on public.message_reactions (member_id);

create table if not exists public.message_reads (
  member_id   uuid primary key references public.members (id) on delete cascade,
  last_read_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- The browser never talks to Supabase directly. Next.js uses a server-only
-- secret/service-role key. Existing app-data policies remain permissive for
-- compatibility, but member_credentials deliberately has no anon/authenticated
-- policy so password hashes cannot be read with the publishable key.
-- ----------------------------------------------------------------------------
alter table public.members    enable row level security;
alter table public.daily_logs enable row level security;
alter table public.sessions   enable row level security;
alter table public.session_rsvps enable row level security;
alter table public.session_reads enable row level security;
alter table public.workouts   enable row level security;
alter table public.runs       enable row level security;
alter table public.run_attendees enable row level security;
alter table public.weight_measurements enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_reads enable row level security;
alter table public.member_credentials enable row level security;
alter table public.member_links enable row level security;

drop policy if exists members_rw    on public.members;
drop policy if exists daily_logs_rw on public.daily_logs;
drop policy if exists sessions_rw   on public.sessions;
drop policy if exists session_rsvps_rw on public.session_rsvps;
drop policy if exists session_reads_rw on public.session_reads;
drop policy if exists workouts_rw   on public.workouts;
drop policy if exists runs_rw       on public.runs;
drop policy if exists run_attendees_rw on public.run_attendees;
drop policy if exists weight_measurements_rw on public.weight_measurements;
drop policy if exists messages_rw on public.messages;
drop policy if exists message_reactions_rw on public.message_reactions;
drop policy if exists message_reads_rw on public.message_reads;
drop policy if exists member_credentials_rw on public.member_credentials;
drop policy if exists member_links_rw on public.member_links;

create policy members_rw    on public.members    for all to anon, authenticated using (true) with check (true);
create policy daily_logs_rw on public.daily_logs for all to anon, authenticated using (true) with check (true);
create policy sessions_rw   on public.sessions   for all to anon, authenticated using (true) with check (true);
create policy session_rsvps_rw on public.session_rsvps for all to anon, authenticated using (true) with check (true);
create policy session_reads_rw on public.session_reads for all to anon, authenticated using (true) with check (true);
create policy workouts_rw   on public.workouts   for all to anon, authenticated using (true) with check (true);
create policy runs_rw       on public.runs       for all to anon, authenticated using (true) with check (true);
create policy run_attendees_rw on public.run_attendees for all to anon, authenticated using (true) with check (true);
create policy weight_measurements_rw on public.weight_measurements for all to anon, authenticated using (true) with check (true);
create policy messages_rw on public.messages for all to anon, authenticated using (true) with check (true);
create policy message_reactions_rw on public.message_reactions for all to anon, authenticated using (true) with check (true);
create policy message_reads_rw on public.message_reads for all to anon, authenticated using (true) with check (true);
create policy member_links_rw on public.member_links for all to anon, authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Profile avatars — one deterministic object per member. Uploading again uses
-- upsert, so this bucket cannot accumulate multiple profile pictures per user.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_insert on storage.objects;
drop policy if exists profile_avatars_select on storage.objects;
drop policy if exists profile_avatars_update on storage.objects;
drop policy if exists profile_avatars_delete on storage.objects;

create policy profile_avatars_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-avatars');

create policy profile_avatars_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'profile-avatars');

create policy profile_avatars_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'profile-avatars')
  with check (bucket_id = 'profile-avatars');

create policy profile_avatars_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'profile-avatars');

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
