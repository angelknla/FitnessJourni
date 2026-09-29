import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/lib/testing/supabaseMock';

/**
 * What a group-scoped read is allowed to ask the database for.
 *
 * Cross-group isolation is decided by the filters on these queries, so this
 * asserts the filters themselves: a group read is always narrowed by group id, the
 * viewer's own half is narrowed to them, and Personal mode never asks for anything
 * shared at all.
 */

let supabase: SupabaseMock;

vi.mock('@/lib/supabase/server', () => ({
  getSupabase: () => supabase.client,
}));

import { getLogsForDate, getLogsSince } from './logs';
import { getMessages } from './messages';
import { getRunsSince } from './runs';
import { getUpcomingSessions } from './sessions';
import { getWorkoutsSince } from './workouts';

/** Flattens one recorded chain into ['method', ...args] tuples. */
const opsOf = (table: string) => supabase.callsTo(table).map((call) => call.ops);

beforeEach(() => {
  supabase = createSupabaseMock();
});

describe('shared records in a group', () => {
  it('narrows the group read to that group, and the personal read to the viewer', async () => {
    await getLogsSince('2026-09-01', { groupId: 'g1', memberId: 'm1' });

    const [shared, own] = opsOf('daily_logs');
    expect(shared).toEqual(
      expect.arrayContaining([
        ['select', '*, group_daily_logs!inner(group_id)'],
        ['eq', 'group_daily_logs.group_id', 'g1'],
        ['gte', 'log_date', '2026-09-01'],
      ])
    );
    expect(own).toEqual(
      expect.arrayContaining([
        ['select', '*'],
        ['eq', 'member_id', 'm1'],
      ])
    );
  });

  it('never reads a group other than the active one', async () => {
    await getLogsSince('2026-09-01', { groupId: 'g1', memberId: 'm1' });
    await getLogsForDate('2026-09-29', { groupId: 'g1', memberId: 'm1' });

    const groupFilters = supabase.calls
      .flatMap((call) => call.ops)
      .filter(([name, column]) => name === 'eq' && String(column).endsWith('.group_id'));

    expect(groupFilters.length).toBeGreaterThan(0);
    for (const [, , value] of groupFilters) {
      expect(value).toBe('g1');
    }
  });

  it('scopes workouts and runs the same way', async () => {
    await getWorkoutsSince('2026-09-01', { groupId: 'g1', memberId: 'm1' });
    await getRunsSince('2026-09-01', { groupId: 'g1', memberId: 'm1' });

    expect(opsOf('workouts')[0]).toEqual(
      expect.arrayContaining([['eq', 'group_workouts.group_id', 'g1']])
    );
    expect(opsOf('runs')[0]).toEqual(expect.arrayContaining([['eq', 'group_runs.group_id', 'g1']]));
  });

  it('attributes a run by who logged it, not by who attended', async () => {
    await getRunsSince('2026-09-01', { groupId: null, memberId: 'm1' });

    expect(opsOf('runs')[0]).toEqual(expect.arrayContaining([['eq', 'created_by', 'm1']]));
  });
});

describe('Personal mode', () => {
  it('reads only the viewer’s own records, with no group filter anywhere', async () => {
    await getLogsSince('2026-09-01', { groupId: null, memberId: 'm1' });

    const calls = opsOf('daily_logs');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        ['select', '*'],
        ['eq', 'member_id', 'm1'],
      ])
    );
    expect(JSON.stringify(calls)).not.toContain('group_daily_logs');
  });

  it('has no chat and no sessions, and sends no query for them', async () => {
    await expect(getMessages(null)).resolves.toEqual([]);
    await expect(getUpcomingSessions('2026-09-29', null)).resolves.toEqual([]);

    expect(supabase.calls).toHaveLength(0);
  });
});

describe('an empty scope', () => {
  it('asks the database for nothing at all', async () => {
    await expect(getLogsSince('2026-09-01', { groupId: null, memberId: null })).resolves.toEqual(
      []
    );
    await expect(getLogsForDate('2026-09-29', { groupId: null, memberId: null })).resolves.toEqual(
      {}
    );
    await expect(
      getWorkoutsSince('2026-09-01', { groupId: null, memberId: null })
    ).resolves.toEqual([]);

    expect(supabase.calls).toHaveLength(0);
  });
});

describe('group-owned content', () => {
  it('filters chat by group', async () => {
    supabase = createSupabaseMock({ messages: { data: [] } });

    await getMessages('g1');

    expect(opsOf('messages')[0]).toEqual(expect.arrayContaining([['eq', 'group_id', 'g1']]));
  });

  it('filters sessions by group', async () => {
    supabase = createSupabaseMock({ sessions: { data: [] } });

    await getUpcomingSessions('2026-09-29', 'g1');

    expect(opsOf('sessions')[0]).toEqual(expect.arrayContaining([['eq', 'group_id', 'g1']]));
  });
});
