import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural assertions over the schema.
 *
 * These cannot execute SQL — there is no database in the test environment — so
 * they guard the guarantees the application layer is entitled to assume: that the
 * migration is idempotent, that duplicates are impossible rather than merely
 * checked for, that deleting a group cannot take personal records with it, and
 * that the group tables are unreadable with the publishable key.
 *
 * Every one of these has been a real class of bug in this kind of feature, and
 * each is a single line somebody could remove without any test noticing.
 */
/* Vitest serves this module over a non-file URL, so the path is resolved from
 * the project root rather than from import.meta.url. */
const schema = readFileSync(join(process.cwd(), 'supabase/schema.sql'), 'utf8');

/** Collapses whitespace so an assertion is not hostage to line wrapping. */
const flat = schema.replace(/\s+/g, ' ');

describe('group tables', () => {
  it('gives every group a uuid primary key and a unique join code', () => {
    expect(flat).toContain('create table if not exists public.groups');
    expect(flat).toContain('id uuid primary key default gen_random_uuid()');
    expect(flat).toContain('create unique index if not exists groups_join_code_idx');
    expect(flat).toContain('on public.groups (join_code)');
  });

  it('constrains join codes to the unambiguous alphabet', () => {
    expect(flat).toContain('groups_join_code_format_check');
    // No I, L, O, 0 or 1 — matches JOIN_CODE_ALPHABET in lib/groups.ts.
    expect(flat).toContain(
      '[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}'
    );
  });

  it('has no member-count column, because the count is derived', () => {
    const groupsTable = schema.slice(
      schema.indexOf('create table if not exists public.groups'),
      schema.indexOf('alter table public.groups drop constraint')
    );
    expect(groupsTable).not.toMatch(/member_count/);
  });

  it('restricts roles to the three that exist', () => {
    expect(flat).toContain(
      "role text not null default 'member' check (role in ('owner', 'admin', 'member'))"
    );
  });

  it('allows only one owner per group, in the database rather than by care', () => {
    expect(flat).toContain('create unique index if not exists group_members_one_owner_idx');
    expect(flat).toContain("on public.group_members (group_id) where role = 'owner'");
  });
});

describe('the active group', () => {
  it('allows exactly one per member', () => {
    expect(flat).toContain('create table if not exists public.member_active_groups');
    expect(flat).toContain(
      'member_id uuid primary key references public.members (id) on delete cascade'
    );
  });

  it('can only ever point at an accepted membership', () => {
    // The composite key makes "active in a group I am not in" unrepresentable,
    // and cascades the pointer away the moment the membership ends.
    expect(flat).toContain('member_active_groups_membership_fkey');
    expect(flat).toContain(
      'foreign key (member_id, group_id) references public.group_members (member_id, group_id) on delete cascade'
    );
  });
});

describe('invitations and join requests', () => {
  it('keeps one open row per pair, so a second tap cannot duplicate one', () => {
    expect(flat).toContain('create unique index if not exists group_invitations_pending_idx');
    expect(flat).toContain(
      "on public.group_invitations (group_id, member_id) where status = 'pending'"
    );
    expect(flat).toContain('create unique index if not exists group_join_requests_pending_idx');
    expect(flat).toContain(
      "on public.group_join_requests (group_id, member_id) where status = 'pending'"
    );
  });

  it('keeps answered rows, so a request status can still be shown', () => {
    expect(flat).toContain("check (status in ('pending', 'accepted', 'declined', 'cancelled'))");
    expect(flat).toContain("check (status in ('pending', 'approved', 'rejected', 'cancelled'))");
  });

  it('indexes the lookups the UI actually makes', () => {
    expect(flat).toContain('group_invitations_member_idx');
    expect(flat).toContain('group_join_requests_group_idx');
    expect(flat).toContain('group_members_member_group_idx');
  });
});

describe('record visibility', () => {
  it('associates records with groups explicitly, per record type', () => {
    for (const table of ['group_daily_logs', 'group_workouts', 'group_runs']) {
      expect(flat).toContain(`create table if not exists public.${table}`);
    }
  });

  it('cascades from both sides, so neither orphans the other', () => {
    expect(flat).toContain(
      'daily_log_id uuid not null references public.daily_logs (id) on delete cascade'
    );
    expect(flat).toContain(
      'workout_id uuid not null references public.workouts (id) on delete cascade'
    );
    expect(flat).toContain('run_id uuid not null references public.runs (id) on delete cascade');
  });

  it('documents both halves of the rule, not just the association', () => {
    // The comment matters as much as the tables: current membership is what makes
    // a group see your history, and these rows are what keep a former member's
    // days visible after they leave.
    expect(schema).toMatch(/belongs to that group right now/);
    expect(schema).toMatch(/former member's days visible after/);
  });
});

describe('collaborative content', () => {
  it('belongs to one group and is deleted with it', () => {
    expect(flat).toContain(
      'alter table public.sessions add column if not exists group_id uuid references public.groups (id) on delete cascade'
    );
    expect(flat).toContain(
      'alter table public.messages add column if not exists group_id uuid references public.groups (id) on delete cascade'
    );
  });

  it('is required once the migration has given every row a group', () => {
    expect(flat).toContain('alter table public.sessions alter column group_id set not null');
    expect(flat).toContain('alter table public.messages alter column group_id set not null');
  });

  it('keeps read cursors per group', () => {
    expect(flat).toContain(
      'alter table public.message_reads add primary key (member_id, group_id)'
    );
    expect(flat).toContain(
      'alter table public.session_reads add primary key (member_id, group_id)'
    );
  });

  it('indexes chat and sessions by group', () => {
    expect(flat).toContain('on public.sessions (group_id, session_date, session_time)');
    expect(flat).toContain('on public.messages (group_id, created_at desc)');
  });
});

describe('operations that must be atomic', () => {
  it('exists as functions rather than as several client round trips', () => {
    for (const routine of [
      'create_group',
      'accept_group_invitation',
      'approve_group_join_request',
      'transfer_group_ownership',
      'leave_group',
      'remove_group_member',
      'set_group_member_role',
      'regenerate_group_join_code',
      'delete_group',
      'reassign_active_group',
    ]) {
      expect(flat).toContain(`create or replace function public.${routine}`);
    }
  });

  it('demotes before promoting, which the one-owner index requires', () => {
    const transfer = schema.slice(
      schema.indexOf('function public.transfer_group_ownership'),
      schema.indexOf('function public.leave_group')
    );
    const demote = transfer.indexOf("set role = 'admin'");
    const promote = transfer.indexOf("set role = 'owner'");
    expect(demote).toBeGreaterThan(-1);
    expect(promote).toBeGreaterThan(demote);
  });

  it('refuses to let the last owner leave', () => {
    const leave = schema.slice(
      schema.indexOf('function public.leave_group'),
      schema.indexOf('function public.remove_group_member')
    );
    expect(leave).toContain("if v_role = 'owner' then return 'last_owner'");
  });

  it('stops an admin managing the owner or another admin', () => {
    const remove = schema.slice(
      schema.indexOf('function public.remove_group_member'),
      schema.indexOf('function public.set_group_member_role')
    );
    expect(remove).toContain("if v_target_role = 'owner' then return 'forbidden'");
    expect(remove).toContain(
      "if v_actor_role = 'admin' and v_target_role <> 'member' then return 'forbidden'"
    );
  });

  it('only lets the owner change roles', () => {
    const roles = schema.slice(
      schema.indexOf('function public.set_group_member_role'),
      schema.indexOf('function public.regenerate_group_join_code')
    );
    expect(roles).toContain("and role = 'owner'");
    expect(roles).toContain("if p_role not in ('admin', 'member') then return 'forbidden'");
  });

  it('deletes a group by deleting the group, so the cascades do the rest', () => {
    const remove = schema.slice(schema.indexOf('function public.delete_group'));
    expect(remove).toContain("and role = 'owner'");
    expect(remove).toContain('delete from public.groups where id = p_group_id');
    // Nothing here touches daily_logs, workouts or runs: personal records survive.
    expect(remove).not.toMatch(/delete from public\.(daily_logs|workouts|runs)\b/);
    // Everyone who lost their group is moved on, or falls back to Personal mode.
    expect(remove).toContain('perform public.reassign_active_group(v_member)');
  });

  it('reassigns the active group deterministically', () => {
    const reassign = schema.slice(
      schema.indexOf('function public.reassign_active_group'),
      schema.indexOf('function public.create_group')
    );
    expect(reassign).toContain('order by gm.joined_at, gm.group_id');
    expect(reassign).toContain('limit 1');
  });
});

describe('the Nine Elms migration', () => {
  const migration = schema.slice(
    schema.indexOf('-- Migration: the existing group becomes "Nine Elms"'),
    schema.indexOf('-- Tighten the collaborative-content columns')
  );

  it('creates the group and makes Angel its owner', () => {
    expect(migration).toContain("where lower(trim(name)) = 'angel'");
    expect(migration).toContain("values ('Nine Elms', null, public.generate_group_join_code())");
    expect(migration).toContain("values (v_group_id, v_owner_id, 'owner')");
  });

  it('adds the four existing users as accepted members', () => {
    expect(migration).toContain("lower(trim(m.name)) in ('angel', 'dillon', 'bradley', 'pani')");
  });

  it('starts with a blank description', () => {
    expect(migration).toContain("'Nine Elms', null,");
  });

  it('is safe to apply twice — it finds the group before creating one', () => {
    expect(migration).toContain(
      "select id into v_group_id from public.groups where name = 'Nine Elms'"
    );
    expect(migration).toContain('if v_group_id is null then');
  });

  it('never duplicates a row or overwrites a later role change', () => {
    // Every insert is guarded, and the owner insert is skipped when one exists,
    // so a re-run cannot fight a transfer that happened since.
    expect(migration).toContain('on conflict (group_id, member_id) do nothing');
    expect(migration).toContain('on conflict (group_id, daily_log_id) do nothing');
    expect(migration).toContain('on conflict (group_id, workout_id) do nothing');
    expect(migration).toContain('on conflict (group_id, run_id) do nothing');
    expect(migration).toContain('on conflict (member_id) do nothing');
    expect(migration).toMatch(
      /if not exists \(\s*select 1 from public\.group_members where group_id = v_group_id and role = 'owner'\s*\) then/
    );
  });

  it('associates the existing shared activity and collaborative content', () => {
    expect(migration).toContain('insert into public.group_daily_logs');
    expect(migration).toContain('insert into public.group_workouts');
    expect(migration).toContain('insert into public.group_runs');
    expect(migration).toContain(
      'update public.sessions set group_id = v_group_id where group_id is null'
    );
    expect(migration).toContain(
      'update public.messages set group_id = v_group_id where group_id is null'
    );
  });

  it('makes it the active group for those members', () => {
    expect(migration).toContain('insert into public.member_active_groups (member_id, group_id)');
    expect(migration).toContain('where gm.group_id = v_group_id');
  });

  it('does nothing at all when there is no Angel to own it', () => {
    expect(migration).toMatch(/if v_owner_id is null then\s*return;\s*end if;/);
  });
});

describe('row level security', () => {
  it('is enabled on every group table', () => {
    for (const table of [
      'groups',
      'group_members',
      'member_active_groups',
      'group_invitations',
      'group_join_requests',
      'group_daily_logs',
      'group_workouts',
      'group_runs',
    ]) {
      expect(flat).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('grants the publishable key no policy at all, so groups cannot be enumerated', () => {
    const groupsSection = schema.slice(
      schema.indexOf('-- Row Level Security for the group tables')
    );
    expect(groupsSection).not.toMatch(/create policy \w+ on public\.group/);
    expect(groupsSection).not.toMatch(/create policy \w+ on public\.member_active_groups/);
  });

  it('takes the default PUBLIC execute grant off the group functions', () => {
    // Without this, anyone holding the publishable key could call delete_group
    // straight through the REST endpoint.
    expect(flat).toContain('revoke all on function %s from public');
    expect(flat).toContain('revoke all on function %s from anon');
    expect(flat).toContain('revoke all on function %s from authenticated');
    expect(flat).toContain('grant execute on function %s to service_role');
  });
});
