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

-- ============================================================================
-- Groups
--
-- A registered user may belong to several groups and has exactly one active one
-- at a time. The active group decides which members and which shared content
-- they see, so every group-scoped query and mutation re-derives it on the server
-- from these tables — a group id arriving from the browser is never trusted.
--
-- Roles live in group_members and nowhere else. `groups` deliberately has no
-- owner_id column: two places recording who owns a group is two places to drift,
-- and the partial unique index below already guarantees exactly one owner row.
-- ============================================================================

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  join_code   text not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.groups drop constraint if exists groups_name_length_check;
alter table public.groups add constraint groups_name_length_check
  check (char_length(trim(name)) between 2 and 40);

/*
 * A group's picture, as a public storage URL. Null means no picture, and the UI
 * falls back to the two-figure icon rather than to a placeholder image — a group
 * without a photo is a normal state, not a missing asset.
 */
alter table public.groups add column if not exists avatar_path text;

alter table public.groups drop constraint if exists groups_description_length_check;
alter table public.groups add constraint groups_description_length_check
  check (description is null or char_length(description) <= 200);

/*
 * Join codes are shown to people and typed back in, so the alphabet drops every
 * character that gets misread out loud or in a screenshot: no I, L, O, 0 or 1.
 * The constraint is the real enforcement — lib/groups.ts generates codes in the
 * same alphabet, and normalizeJoinCode() upper-cases and re-hyphenates whatever
 * someone pastes before it reaches here.
 */
alter table public.groups drop constraint if exists groups_join_code_format_check;
alter table public.groups add constraint groups_join_code_format_check
  check (join_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$');

create unique index if not exists groups_join_code_idx on public.groups (join_code);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, member_id)
);

/*
 * Reversed-order unique index. It serves "which groups is this person in", and
 * it is the target member_active_groups points its composite key at — which is
 * what makes an active group that is not an accepted membership unrepresentable.
 */
create unique index if not exists group_members_member_group_idx
  on public.group_members (member_id, group_id);

/* A group has at most one owner, enforced by the database rather than by care. */
create unique index if not exists group_members_one_owner_idx
  on public.group_members (group_id) where role = 'owner';

/*
 * The active group, persisted so it survives sessions and devices rather than
 * living in a cookie. One row per member is the "exactly one at a time" rule.
 *
 * The composite foreign key means losing the membership drops the active-group
 * row with it, so a removed member can never still be pointed at the group.
 */
create table if not exists public.member_active_groups (
  member_id  uuid primary key references public.members (id) on delete cascade,
  group_id   uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.member_active_groups
  drop constraint if exists member_active_groups_membership_fkey;
alter table public.member_active_groups add constraint member_active_groups_membership_fkey
  foreign key (member_id, group_id) references public.group_members (member_id, group_id)
  on delete cascade on update cascade;

/*
 * Invitations and join requests are separate tables because they are separate
 * flows: a manager raises an invitation and the invited person answers it; a
 * person raises a request and a manager answers that. Answered rows are kept so
 * Profile can show "you asked to join" after the fact, and the partial unique
 * indexes allow exactly one open row per pair — which is what stops a second tap
 * from creating a duplicate.
 */
create table if not exists public.group_invitations (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  invited_by   uuid references public.members (id) on delete set null,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists group_invitations_pending_idx
  on public.group_invitations (group_id, member_id) where status = 'pending';
create index if not exists group_invitations_member_idx
  on public.group_invitations (member_id, status);

create table if not exists public.group_join_requests (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at  timestamptz not null default now(),
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz
);

create unique index if not exists group_join_requests_pending_idx
  on public.group_join_requests (group_id, member_id) where status = 'pending';
create index if not exists group_join_requests_member_idx
  on public.group_join_requests (member_id, status);
create index if not exists group_join_requests_group_idx
  on public.group_join_requests (group_id, status);

-- ----------------------------------------------------------------------------
-- Record visibility
--
-- Personal activity is recorded once, not once per group. These association
-- tables record which groups a record was shared with AT THE MOMENT IT WAS
-- CREATED, which is what makes the two hard rules possible at the same time:
--
--   * joining a group does not expose anything logged before joining, because
--     no row was written for a group that did not yet contain the author;
--   * leaving a group does not retract what was already shared, because the
--     rows survive the membership that produced them.
--
-- Deriving visibility from current membership instead would get both wrong.
-- Activity logged in Personal mode has no rows here at all, and stays private.
-- ----------------------------------------------------------------------------
create table if not exists public.group_daily_logs (
  group_id     uuid not null references public.groups (id) on delete cascade,
  daily_log_id uuid not null references public.daily_logs (id) on delete cascade,
  shared_at    timestamptz not null default now(),
  primary key (group_id, daily_log_id)
);

create index if not exists group_daily_logs_log_idx on public.group_daily_logs (daily_log_id);

create table if not exists public.group_workouts (
  group_id   uuid not null references public.groups (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  shared_at  timestamptz not null default now(),
  primary key (group_id, workout_id)
);

create index if not exists group_workouts_workout_idx on public.group_workouts (workout_id);

create table if not exists public.group_runs (
  group_id  uuid not null references public.groups (id) on delete cascade,
  run_id    uuid not null references public.runs (id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (group_id, run_id)
);

create index if not exists group_runs_run_idx on public.group_runs (run_id);

-- ----------------------------------------------------------------------------
-- Collaborative content belongs to one group outright, so it carries the group
-- id directly and is deleted with the group rather than merely hidden.
-- Reactions and RSVPs follow their parent through the existing cascades.
--
-- The column is added nullable here and made NOT NULL further down, after the
-- Nine Elms migration has given every pre-existing row a home.
-- ----------------------------------------------------------------------------
alter table public.sessions
  add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.messages
  add column if not exists group_id uuid references public.groups (id) on delete cascade;

create index if not exists sessions_group_when_idx
  on public.sessions (group_id, session_date, session_time);
create index if not exists messages_group_created_idx
  on public.messages (group_id, created_at desc);

/*
 * Read cursors become per group: "everything in this chat is read" is a
 * statement about one group's chat, and switching groups must not carry the
 * cursor across or the new-post dot would lie in both directions.
 */
alter table public.message_reads
  add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.session_reads
  add column if not exists group_id uuid references public.groups (id) on delete cascade;

-- ----------------------------------------------------------------------------
-- Group operations that have to be atomic
--
-- supabase-js sends one statement per call, so anything that must not be
-- observed half-done — accepting an invitation, approving a request, handing
-- ownership over, deleting a group — lives here instead. A plpgsql function body
-- is a single transaction, which is what "transactional where possible" means on
-- this stack.
--
-- Each one re-checks the caller's role itself. The Server Action checks first so
-- it can explain the refusal; these check again so the rule holds even if a
-- future caller forgets. They return a short code rather than raising, so the
-- action can turn it into a sentence the person can act on.
-- ----------------------------------------------------------------------------

/* Same alphabet as lib/groups.ts, and the same one groups_join_code_format_check
 * enforces: no I, L, O, 0 or 1. Retries on collision against the unique index. */
create or replace function public.generate_group_join_code() returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  attempts  integer := 0;
begin
  loop
    candidate := '';
    for position in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
      if position = 4 then
        candidate := candidate || '-';
      end if;
    end loop;

    exit when not exists (select 1 from public.groups g where g.join_code = candidate);

    attempts := attempts + 1;
    if attempts > 100 then
      raise exception 'Could not allocate a unique group join code';
    end if;
  end loop;

  return candidate;
end;
$$;

/*
 * Picks up the pieces after a membership ends. Deterministic — oldest membership
 * first, ties broken by group id — so the same input always lands on the same
 * group, and someone with nothing left simply has no row and is back in Personal
 * mode. Never overwrites an active group that is still valid.
 */
create or replace function public.reassign_active_group(p_member_id uuid) returns void
language plpgsql
as $$
begin
  if exists (select 1 from public.member_active_groups where member_id = p_member_id) then
    return;
  end if;

  insert into public.member_active_groups (member_id, group_id)
  select gm.member_id, gm.group_id
    from public.group_members gm
   where gm.member_id = p_member_id
   order by gm.joined_at, gm.group_id
   limit 1
  on conflict (member_id) do nothing;
end;
$$;

/* The creator becomes the owner, and lands in the group they just made. */
create or replace function public.create_group(
  p_name        text,
  p_description text,
  p_owner_id    uuid
) returns table (group_id uuid, join_code text)
language plpgsql
as $$
declare
  v_group_id uuid;
  v_code     text;
begin
  v_code := public.generate_group_join_code();

  insert into public.groups (name, description, join_code)
  values (p_name, p_description, v_code)
  returning id into v_group_id;

  insert into public.group_members (group_id, member_id, role)
  values (v_group_id, p_owner_id, 'owner');

  insert into public.member_active_groups (member_id, group_id)
  values (p_owner_id, v_group_id)
  on conflict (member_id) do update
    set group_id = excluded.group_id, updated_at = now();

  return query select v_group_id, v_code;
end;
$$;

create or replace function public.accept_group_invitation(
  p_invitation_id uuid,
  p_member_id     uuid
) returns text
language plpgsql
as $$
declare
  v_invitation public.group_invitations;
begin
  select * into v_invitation
    from public.group_invitations
   where id = p_invitation_id
   for update;

  if not found then return 'not_found'; end if;
  if v_invitation.member_id <> p_member_id then return 'forbidden'; end if;
  if v_invitation.status <> 'pending' then return 'stale'; end if;

  insert into public.group_members (group_id, member_id, role)
  values (v_invitation.group_id, p_member_id, 'member')
  on conflict (group_id, member_id) do nothing;

  update public.group_invitations
     set status = 'accepted', responded_at = now()
   where id = p_invitation_id;

  -- Any request they had open for the same group is moot now they are in.
  update public.group_join_requests
     set status = 'cancelled', reviewed_at = now()
   where group_id = v_invitation.group_id
     and member_id = p_member_id
     and status = 'pending';

  -- Joining does not yank them out of the group they are currently looking at.
  insert into public.member_active_groups (member_id, group_id)
  values (p_member_id, v_invitation.group_id)
  on conflict (member_id) do nothing;

  return 'ok';
end;
$$;

create or replace function public.approve_group_join_request(
  p_request_id  uuid,
  p_reviewer_id uuid
) returns text
language plpgsql
as $$
declare
  v_request public.group_join_requests;
begin
  select * into v_request
    from public.group_join_requests
   where id = p_request_id
   for update;

  if not found then return 'not_found'; end if;
  if v_request.status <> 'pending' then return 'stale'; end if;

  if not exists (
    select 1 from public.group_members
     where group_id = v_request.group_id
       and member_id = p_reviewer_id
       and role in ('owner', 'admin')
  ) then
    return 'forbidden';
  end if;

  insert into public.group_members (group_id, member_id, role)
  values (v_request.group_id, v_request.member_id, 'member')
  on conflict (group_id, member_id) do nothing;

  update public.group_join_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   where id = p_request_id;

  update public.group_invitations
     set status = 'cancelled', responded_at = now()
   where group_id = v_request.group_id
     and member_id = v_request.member_id
     and status = 'pending';

  insert into public.member_active_groups (member_id, group_id)
  values (v_request.member_id, v_request.group_id)
  on conflict (member_id) do nothing;

  return 'ok';
end;
$$;

create or replace function public.transfer_group_ownership(
  p_group_id  uuid,
  p_owner_id  uuid,
  p_member_id uuid
) returns text
language plpgsql
as $$
begin
  if p_owner_id = p_member_id then return 'stale'; end if;

  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id and member_id = p_owner_id and role = 'owner'
  ) then
    return 'forbidden';
  end if;

  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id and member_id = p_member_id
  ) then
    return 'not_found';
  end if;

  /*
   * Demote first. group_members_one_owner_idx is checked per statement, so
   * promoting before demoting would mean two owners for an instant and be
   * rejected. The outgoing owner keeps admin rights rather than dropping to
   * member — they were running the group a moment ago.
   */
  update public.group_members set role = 'admin'
   where group_id = p_group_id and member_id = p_owner_id;
  update public.group_members set role = 'owner'
   where group_id = p_group_id and member_id = p_member_id;
  update public.groups set updated_at = now() where id = p_group_id;

  return 'ok';
end;
$$;

/* The owner cannot leave — a group must always have one. They transfer first. */
create or replace function public.leave_group(
  p_group_id  uuid,
  p_member_id uuid
) returns text
language plpgsql
as $$
declare
  v_role text;
begin
  select role into v_role
    from public.group_members
   where group_id = p_group_id and member_id = p_member_id
   for update;

  if not found then return 'not_found'; end if;
  if v_role = 'owner' then return 'last_owner'; end if;

  delete from public.group_members
   where group_id = p_group_id and member_id = p_member_id;

  perform public.reassign_active_group(p_member_id);
  return 'ok';
end;
$$;

create or replace function public.remove_group_member(
  p_group_id  uuid,
  p_actor_id  uuid,
  p_member_id uuid
) returns text
language plpgsql
as $$
declare
  v_actor_role  text;
  v_target_role text;
begin
  if p_actor_id = p_member_id then return 'stale'; end if;

  select role into v_actor_role from public.group_members
   where group_id = p_group_id and member_id = p_actor_id;
  if not found then return 'forbidden'; end if;

  select role into v_target_role from public.group_members
   where group_id = p_group_id and member_id = p_member_id
   for update;
  if not found then return 'not_found'; end if;

  -- Nobody removes the owner, and an admin may not touch another admin.
  if v_target_role = 'owner' then return 'forbidden'; end if;
  if v_actor_role = 'admin' and v_target_role <> 'member' then return 'forbidden'; end if;
  if v_actor_role not in ('owner', 'admin') then return 'forbidden'; end if;

  delete from public.group_members
   where group_id = p_group_id and member_id = p_member_id;

  perform public.reassign_active_group(p_member_id);
  return 'ok';
end;
$$;

create or replace function public.set_group_member_role(
  p_group_id  uuid,
  p_actor_id  uuid,
  p_member_id uuid,
  p_role      text
) returns text
language plpgsql
as $$
declare
  v_target_role text;
begin
  if p_role not in ('admin', 'member') then return 'forbidden'; end if;
  if p_actor_id = p_member_id then return 'stale'; end if;

  -- Only the owner promotes and demotes; admins cannot make more admins.
  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id and member_id = p_actor_id and role = 'owner'
  ) then
    return 'forbidden';
  end if;

  select role into v_target_role from public.group_members
   where group_id = p_group_id and member_id = p_member_id
   for update;
  if not found then return 'not_found'; end if;
  if v_target_role = 'owner' then return 'forbidden'; end if;
  if v_target_role = p_role then return 'stale'; end if;

  update public.group_members set role = p_role
   where group_id = p_group_id and member_id = p_member_id;

  return 'ok';
end;
$$;

/* Regenerating invalidates the old code the moment this commits. */
create or replace function public.regenerate_group_join_code(
  p_group_id uuid,
  p_actor_id uuid
) returns table (result text, join_code text)
language plpgsql
as $$
declare
  v_code text;
begin
  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id and member_id = p_actor_id and role = 'owner'
  ) then
    return query select 'forbidden'::text, null::text;
    return;
  end if;

  v_code := public.generate_group_join_code();

  update public.groups
     set join_code = v_code, updated_at = now()
   where id = p_group_id;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  return query select 'ok'::text, v_code;
end;
$$;

/*
 * Deleting takes the group and everything that belonged only to it: memberships,
 * invitations, requests, active-group pointers, chat, sessions, and the rows
 * recording what was shared with it. The underlying logs, workouts and runs are
 * personal records and stay exactly where they are — only their association with
 * this group goes. Every former member is then moved to another group of theirs,
 * or left in Personal mode.
 */
create or replace function public.delete_group(
  p_group_id uuid,
  p_actor_id uuid
) returns text
language plpgsql
as $$
declare
  v_members uuid[];
  v_member  uuid;
begin
  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id and member_id = p_actor_id and role = 'owner'
  ) then
    return 'forbidden';
  end if;

  select coalesce(array_agg(member_id), '{}'::uuid[]) into v_members
    from public.group_members where group_id = p_group_id;

  delete from public.groups where id = p_group_id;
  if not found then return 'not_found'; end if;

  foreach v_member in array v_members loop
    perform public.reassign_active_group(v_member);
  end loop;

  return 'ok';
end;
$$;

-- ----------------------------------------------------------------------------
-- Migration: the existing group becomes "Nine Elms"
--
-- Everything this app held before groups existed was shared with everyone, so it
-- all belongs to one group. Angel owns it; Dillon, Bradley and Pani join as
-- accepted members; every existing log, workout, run, session and message is
-- associated with it; and it becomes the active group for all of them.
--
-- Safe to apply repeatedly. The group is found by name before it is created, and
-- every insert is guarded, so a second run changes nothing. Members who have
-- since been promoted keep their role — nothing here overwrites one. Names that
-- do not exist in this deployment are simply skipped, which is what makes it
-- deterministic on a fresh database as well as on the live one.
-- ----------------------------------------------------------------------------
do $$
declare
  v_group_id uuid;
  v_owner_id uuid;
begin
  select id into v_owner_id
    from public.members
   where lower(trim(name)) = 'angel'
   order by created_at, id
   limit 1;

  -- No Angel, nothing to hand the group to. A fresh database will seed one and
  -- pick this up on the next run.
  if v_owner_id is null then
    return;
  end if;

  select id into v_group_id from public.groups where name = 'Nine Elms' limit 1;

  if v_group_id is null then
    insert into public.groups (name, description, join_code)
    values ('Nine Elms', null, public.generate_group_join_code())
    returning id into v_group_id;
  end if;

  -- Owner first, and only if the group has no owner yet: group_members_one_owner_idx
  -- would reject a second one, and a re-run must not fight a later transfer.
  if not exists (
    select 1 from public.group_members where group_id = v_group_id and role = 'owner'
  ) then
    insert into public.group_members (group_id, member_id, role)
    values (v_group_id, v_owner_id, 'owner')
    on conflict (group_id, member_id) do update set role = 'owner';
  end if;

  insert into public.group_members (group_id, member_id, role)
  select v_group_id, m.id, 'member'
    from public.members m
   where lower(trim(m.name)) in ('angel', 'dillon', 'bradley', 'pani')
  on conflict (group_id, member_id) do nothing;

  -- Collaborative content: everything that had no group now has this one.
  update public.sessions set group_id = v_group_id where group_id is null;
  update public.messages set group_id = v_group_id where group_id is null;

  -- Visibility: every record these members already had was shared with them all.
  insert into public.group_daily_logs (group_id, daily_log_id)
  select v_group_id, dl.id
    from public.daily_logs dl
    join public.group_members gm
      on gm.member_id = dl.member_id and gm.group_id = v_group_id
  on conflict (group_id, daily_log_id) do nothing;

  insert into public.group_workouts (group_id, workout_id)
  select v_group_id, w.id
    from public.workouts w
    join public.group_members gm
      on gm.member_id = w.member_id and gm.group_id = v_group_id
  on conflict (group_id, workout_id) do nothing;

  -- Runs were always group runs; ones whose logger has since been removed
  -- (created_by set null by the existing cascade) belong to the group too.
  insert into public.group_runs (group_id, run_id)
  select v_group_id, r.id
    from public.runs r
   where r.created_by is null
      or exists (
        select 1 from public.group_members gm
         where gm.member_id = r.created_by and gm.group_id = v_group_id
      )
  on conflict (group_id, run_id) do nothing;

  -- Read cursors were global; they become this group's cursors.
  update public.message_reads set group_id = v_group_id where group_id is null;
  update public.session_reads set group_id = v_group_id where group_id is null;

  -- And this is the group they all land in.
  insert into public.member_active_groups (member_id, group_id)
  select gm.member_id, v_group_id
    from public.group_members gm
   where gm.group_id = v_group_id
  on conflict (member_id) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- Tighten the collaborative-content columns now that the migration has run.
--
-- Guarded rather than unconditional: if some row still has no group — a database
-- this migration could not place, for instance — the constraint is skipped
-- instead of aborting the whole script. A read cursor is disposable, so a
-- stranded one is dropped; a session or a message never is.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.sessions where group_id is null) then
    alter table public.sessions alter column group_id set not null;
  end if;

  if not exists (select 1 from public.messages where group_id is null) then
    alter table public.messages alter column group_id set not null;
  end if;
end;
$$;

delete from public.message_reads where group_id is null;
delete from public.session_reads where group_id is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'message_reads'
       and column_name = 'group_id' and is_nullable = 'YES'
  ) then
    alter table public.message_reads alter column group_id set not null;
    alter table public.message_reads drop constraint if exists message_reads_pkey;
    alter table public.message_reads add primary key (member_id, group_id);
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'session_reads'
       and column_name = 'group_id' and is_nullable = 'YES'
  ) then
    alter table public.session_reads alter column group_id set not null;
    alter table public.session_reads drop constraint if exists session_reads_pkey;
    alter table public.session_reads add primary key (member_id, group_id);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security for the group tables
--
-- These get RLS with NO anon/authenticated policy at all — the same treatment as
-- member_credentials. The browser never talks to Supabase directly, so nothing
-- legitimate loses access, and the publishable key cannot be used to enumerate
-- groups, memberships, invitations, join codes or who logged what. Only the
-- server-only secret key, which bypasses RLS, can read them.
--
-- The pre-existing app-data policies above stay permissive on purpose, as they
-- were before this feature; authorization for group-scoped data is enforced in
-- the Server Actions and in the functions above, which is where the acting
-- member's identity is actually known.
-- ----------------------------------------------------------------------------
alter table public.groups               enable row level security;
alter table public.group_members        enable row level security;
alter table public.member_active_groups enable row level security;
alter table public.group_invitations    enable row level security;
alter table public.group_join_requests  enable row level security;
alter table public.group_daily_logs     enable row level security;
alter table public.group_workouts       enable row level security;
alter table public.group_runs           enable row level security;

/*
 * Functions are executable by PUBLIC by default, which would let anyone holding
 * the publishable key call delete_group over the REST endpoint. Take that back
 * and hand it to the server key only.
 */
do $$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'generate_group_join_code',
         'reassign_active_group',
         'create_group',
         'accept_group_invitation',
         'approve_group_join_request',
         'transfer_group_ownership',
         'leave_group',
         'remove_group_member',
         'set_group_member_role',
         'regenerate_group_join_code',
         'delete_group'
       )
  loop
    execute format('revoke all on function %s from public', routine.signature);
    execute format('revoke all on function %s from anon', routine.signature);
    execute format('revoke all on function %s from authenticated', routine.signature);
    execute format('grant execute on function %s to service_role', routine.signature);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Group pictures — one deterministic object per group, so uploading again uses
-- upsert and this bucket cannot accumulate several covers for one group.
--
-- Separate from profile-avatars so a group's image and a person's cannot collide.
-- Who may upload is decided in the Server Action against group_members, which is
-- the only place the acting member's role is known.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-images',
  'group-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists group_images_select on storage.objects;
drop policy if exists group_images_insert on storage.objects;
drop policy if exists group_images_update on storage.objects;
drop policy if exists group_images_delete on storage.objects;

create policy group_images_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'group-images');

create policy group_images_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'group-images');

create policy group_images_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'group-images')
  with check (bucket_id = 'group-images');

create policy group_images_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'group-images');
