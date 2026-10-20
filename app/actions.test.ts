import { revalidatePath, updateTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/lib/testing/supabaseMock';

/*
 * The visibility model, asserted where it is actually decided.
 *
 * Creating a record writes one association row per group the author is in AT THAT
 * MOMENT, and editing writes none. Those two facts are the whole mechanism behind
 * "joining exposes nothing earlier" and "leaving retracts nothing already shared",
 * so they are tested directly rather than inferred from the schema.
 */

const state = {
  unlocked: true,
  memberId: 'angel' as string | null,
  groups: [] as { group: { id: string; name: string }; role: string }[],
  groupMemberIds: [] as string[],
};

let supabase: SupabaseMock;

vi.mock('@/lib/session', () => ({
  isUnlocked: vi.fn(async () => state.unlocked),
  readViewer: vi.fn(async () => ({ memberId: state.memberId, chosen: true })),
  hasEnrollmentAccess: vi.fn(async () => false),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabase: () => supabase.client,
}));

vi.mock('@/lib/data/groups', () => ({
  getActiveGroup: async () =>
    state.groups[0]
      ? { id: state.groups[0].group.id, name: state.groups[0].group.name, role: 'member' }
      : null,
  getMemberships: async () => state.groups,
  getGroupMemberIds: async () => state.groupMemberIds,
}));

vi.mock('@/lib/data/members', () => ({
  getMembers: async () => [
    { id: 'angel', name: 'Angel' },
    { id: 'dillon', name: 'Dillon' },
    { id: 'outsider', name: 'Outsider' },
  ],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: vi.fn(), delete: vi.fn() }) }));

import {
  bookSession,
  deleteSession,
  logRun,
  logWorkout,
  markMessagesRead,
  markSessionsRead,
  postMessage,
  saveDailyLog,
  saveProfileInfo,
  saveProfileTargets,
} from './actions';

const form = (fields: Record<string, string | string[]>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      data.append(key, entry);
    }
  }
  return data;
};

const initial = { ok: false };

/** One group, so "shared with the groups I am in" has something to mean. */
const inGroups = (...ids: string[]) => {
  state.groups = ids.map((id) => ({ group: { id, name: id }, role: 'member' }));
};

/** The arguments an upsert on `table` was called with, without the method name. */
const upsertOf = (table: string) =>
  supabase
    .callsTo(table)
    .flatMap((call) => call.ops)
    .find(([name]) => name === 'upsert')
    ?.slice(1);

beforeEach(() => {
  vi.mocked(updateTag).mockClear();
  vi.mocked(revalidatePath).mockClear();
  state.unlocked = true;
  state.memberId = 'angel';
  state.groups = [];
  state.groupMemberIds = [];
  supabase = createSupabaseMock();
});

describe('cache invalidation and read markers', () => {
  it('expires log data after a successful save across all pages', async () => {
    supabase = createSupabaseMock({
      daily_logs: { data: { id: 'log-1' } },
    });
    const result = await saveDailyLog(initial, form({ memberId: 'angel', date: '2026-10-20' }));
    expect(result.ok).toBe(true);
    expect(updateTag).toHaveBeenCalledWith('fitnessjourni:logs');
  });

  it('keeps cached data when a write fails', async () => {
    supabase = createSupabaseMock({ daily_logs: { error: { message: 'write failed' } } });
    const result = await saveDailyLog(initial, form({ memberId: 'angel', date: '2026-10-20' }));
    expect(result.ok).toBe(false);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it.each([
    [markMessagesRead, 'messages', 'message_reads', 'fitnessjourni:message-reads'],
    [markSessionsRead, 'sessions', 'session_reads', 'fitnessjourni:session-reads'],
  ] as const)('only writes unread cursors when they advance (%s)', async (markRead, table, reads, tag) => {
    inGroups('g1');
    supabase = createSupabaseMock({
      [table]: { data: { created_at: '2026-10-20T10:00:00Z' } },
      [reads]: { data: { last_read_at: '2026-10-20T10:00:00Z' } },
    });
    await markRead();
    expect(supabase.used(reads, 'upsert')).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();

    supabase = createSupabaseMock({
      [table]: { data: { created_at: '2026-10-20T10:01:00Z' } },
      [reads]: { data: { last_read_at: '2026-10-20T10:00:00Z' } },
    });
    await markRead();
    expect(supabase.used(reads, 'upsert')).toBe(true);
    expect(updateTag).toHaveBeenCalledWith(tag);
  });
});

describe('logging a day for the first time', () => {
  /** No existing row, and the upsert hands back the new row's id. */
  const asNewLog = () =>
    createSupabaseMock({
      daily_logs: (call) =>
        call.ops.some(([name]) => name === 'upsert') ? { data: { id: 'log-1' } } : { data: null },
    });

  it('shares it with every group the author is in at that moment', async () => {
    supabase = asNewLog();
    inGroups('nine-elms', 'battersea');

    const result = await saveDailyLog(initial, form({ memberId: 'angel', date: '2026-09-29' }));

    expect(result.ok).toBe(true);
    const [rows] = upsertOf('group_daily_logs') as [{ group_id: string; daily_log_id: string }[]];
    expect(rows).toEqual([
      { group_id: 'nine-elms', daily_log_id: 'log-1' },
      { group_id: 'battersea', daily_log_id: 'log-1' },
    ]);
  });

  it('keeps it private in Personal mode, writing no association at all', async () => {
    supabase = asNewLog();
    inGroups();

    const result = await saveDailyLog(initial, form({ memberId: 'angel', date: '2026-09-29' }));

    expect(result.ok).toBe(true);
    expect(supabase.callsTo('group_daily_logs')).toHaveLength(0);
  });
});

describe('editing a day that already exists', () => {
  it('does not re-share it — this is what stops retroactive exposure', async () => {
    /*
     * The row already exists, so it was created before the author joined whatever
     * groups they are in now. Correcting it must not hand those groups a day they
     * were never entitled to see.
     */
    supabase = createSupabaseMock({
      daily_logs: (call) =>
        call.ops.some(([name]) => name === 'upsert')
          ? { data: { id: 'log-1' } }
          : { data: { id: 'log-1' } },
    });
    inGroups('joined-later');

    const result = await saveDailyLog(
      initial,
      form({ memberId: 'angel', date: '2026-01-01', steps: '9000' })
    );

    expect(result.ok).toBe(true);
    expect(supabase.callsTo('group_daily_logs')).toHaveLength(0);
  });
});

describe('logging a workout', () => {
  it('shares it with the author’s current groups', async () => {
    supabase = createSupabaseMock({ workouts: { data: { id: 'workout-1' } } });
    inGroups('nine-elms');

    const result = await logWorkout(
      initial,
      form({ memberId: 'angel', date: '2026-09-29', focus: ['upper'] })
    );

    expect(result.ok).toBe(true);
    const [rows] = upsertOf('group_workouts') as [{ group_id: string; workout_id: string }[]];
    expect(rows).toEqual([{ group_id: 'nine-elms', workout_id: 'workout-1' }]);
  });

  it('stays private with no group', async () => {
    supabase = createSupabaseMock({ workouts: { data: { id: 'workout-1' } } });
    inGroups();

    await logWorkout(initial, form({ memberId: 'angel', date: '2026-09-29', focus: ['legs'] }));

    expect(supabase.callsTo('group_workouts')).toHaveLength(0);
  });
});

describe('logging a run', () => {
  const runForm = (attendees: string[]) =>
    form({
      createdBy: 'angel',
      date: '2026-09-29',
      hours: '1',
      minutes: '0',
      distanceKm: '10',
      attendee: attendees,
    });

  it('shares it, and only lists attendees from the group it is logged in', async () => {
    supabase = createSupabaseMock({ runs: { data: { id: 'run-1' } } });
    inGroups('nine-elms');
    state.groupMemberIds = ['angel', 'dillon'];

    const result = await logRun(initial, runForm(['dillon', 'outsider']));

    expect(result.ok).toBe(true);

    // 'outsider' is a real member but not in this group, so it is dropped.
    const [attendeeRows] = supabase.argsFor('run_attendees', 'insert') as [{ member_id: string }[]];
    expect(attendeeRows.map((row) => row.member_id)).toEqual(['angel', 'dillon']);

    const [shared] = upsertOf('group_runs') as [{ group_id: string; run_id: string }[]];
    expect(shared).toEqual([{ group_id: 'nine-elms', run_id: 'run-1' }]);
  });

  it('is the logger alone in Personal mode', async () => {
    supabase = createSupabaseMock({ runs: { data: { id: 'run-1' } } });
    inGroups();

    await logRun(initial, runForm(['dillon']));

    const [attendeeRows] = supabase.argsFor('run_attendees', 'insert') as [{ member_id: string }[]];
    expect(attendeeRows.map((row) => row.member_id)).toEqual(['angel']);
    expect(supabase.callsTo('group_runs')).toHaveLength(0);
  });
});

describe('chat belongs to a group outright', () => {
  it('refuses to post in Personal mode rather than creating an orphan', async () => {
    inGroups();

    const result = await postMessage(initial, form({ content: 'morning all' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/join or create a group/i);
    expect(supabase.used('messages', 'insert')).toBe(false);
  });

  it('stamps the active group on the message', async () => {
    supabase = createSupabaseMock({
      messages: { data: { id: 'message-1', created_at: '2026-09-29T08:00:00.000Z' } },
    });
    inGroups('nine-elms');

    const result = await postMessage(initial, form({ content: 'morning all' }));

    expect(result.ok).toBe(true);
    const [row] = supabase.argsFor('messages', 'insert') as [{ group_id: string }];
    expect(row.group_id).toBe('nine-elms');
  });

  it('keeps the read cursor per group', async () => {
    supabase = createSupabaseMock({
      messages: { data: { id: 'message-1', created_at: '2026-09-29T08:00:00.000Z' } },
    });
    inGroups('nine-elms');

    await postMessage(initial, form({ content: 'morning all' }));

    const [row, options] = supabase.argsFor('message_reads', 'upsert') as [
      { member_id: string; group_id: string },
      { onConflict: string },
    ];
    expect(row).toMatchObject({ member_id: 'angel', group_id: 'nine-elms' });
    expect(options.onConflict).toBe('member_id,group_id');
  });
});

describe('sessions belong to a group outright', () => {
  const booking = form({
    createdBy: 'angel',
    date: '2099-01-01',
    time: '07:30',
    activity: 'run',
  });

  it('refuses to book in Personal mode', async () => {
    inGroups();

    const result = await bookSession(initial, booking);

    expect(result.ok).toBe(false);
    expect(supabase.used('sessions', 'insert')).toBe(false);
  });

  it('stamps the group, and looks for a clash only inside it', async () => {
    supabase = createSupabaseMock({
      sessions: (call) =>
        call.ops.some(([name]) => name === 'insert')
          ? { data: { created_at: '2026-09-29T08:00:00.000Z' } }
          : { data: [] },
    });
    inGroups('nine-elms');

    const result = await bookSession(initial, booking);

    expect(result.ok).toBe(true);
    const [row] = supabase.argsFor('sessions', 'insert') as [{ group_id: string }];
    expect(row.group_id).toBe('nine-elms');

    // Two groups booking the same slot is not a clash, so the check is scoped.
    const clashCheck = supabase.callsTo('sessions')[0];
    expect(clashCheck.ops).toEqual(expect.arrayContaining([['eq', 'group_id', 'nine-elms']]));
  });

  it('deletes only within the group being viewed', async () => {
    inGroups('nine-elms');

    await deleteSession(initial, form({ id: 'session-1' }));

    const deletion = supabase.callsTo('sessions')[0];
    expect(deletion.ops).toEqual(
      expect.arrayContaining([
        ['delete'],
        ['eq', 'id', 'session-1'],
        ['eq', 'group_id', 'nine-elms'],
      ])
    );
  });

  it('refuses to delete at all in Personal mode', async () => {
    inGroups();

    const result = await deleteSession(initial, form({ id: 'session-1' }));

    expect(result.ok).toBe(false);
    expect(supabase.used('sessions', 'delete')).toBe(false);
  });
});

describe('ownership of a write', () => {
  it('refuses to log a day for someone else', async () => {
    state.memberId = 'dillon';
    inGroups('nine-elms');

    const result = await saveDailyLog(initial, form({ memberId: 'angel', date: '2026-09-29' }));

    expect(result.ok).toBe(false);
    expect(supabase.used('daily_logs', 'upsert')).toBe(false);
  });

  it('refuses to book a session as someone else', async () => {
    state.memberId = 'dillon';
    inGroups('nine-elms');

    const result = await bookSession(
      initial,
      form({ createdBy: 'angel', date: '2099-01-01', time: '07:30', activity: 'run' })
    );

    expect(result.ok).toBe(false);
    expect(supabase.used('sessions', 'insert')).toBe(false);
  });
});

describe('saving profile information', () => {
  it('updates personal and measurement fields and records changed current weight', async () => {
    const result = await saveProfileInfo(
      initial,
      form({
        memberId: 'angel',
        name: 'Angel',
        surname: 'Hart',
        age: '34',
        heightCm: '180',
        currentDate: '2026-09-29',
        currentWeightKg: '79.5',
        saveCurrentWeight: 'true',
      })
    );

    expect(result).toMatchObject({ ok: true, message: 'Information saved.' });
    expect(supabase.argsFor('members', 'update')?.[0]).toEqual({
      name: 'Angel',
      surname: 'Hart',
      age: 34,
      height_cm: 180,
    });
    expect(supabase.argsFor('weight_measurements', 'upsert')?.[0]).toMatchObject({
      member_id: 'angel',
      month_start: '2026-09-01',
      measured_on: '2026-09-29',
      weight_kg: 79.5,
    });
  });
});

describe('saving profile targets', () => {
  it('updates goals and nutrition targets without requiring profile fields', async () => {
    const result = await saveProfileTargets(
      initial,
      form({
        memberId: 'angel',
        targetWeightKg: '75',
        targetBmi: '23',
        targetSleepHours: '8.5',
        targetCalories: '2500',
        targetProtein: '156',
        targetCarbs: '313',
        targetFat: '69',
      })
    );

    expect(result).toMatchObject({ ok: true, message: 'Goals and targets saved.' });
    expect(supabase.argsFor('members', 'update')?.[0]).toEqual({
      target_weight_kg: 75,
      target_bmi: 23,
      target_sleep_hours: 8.5,
      target_calories: 2500,
      target_protein: 156,
      target_carbs: 313,
      target_fat: 69,
    });
    expect(supabase.callsTo('weight_measurements')).toHaveLength(0);
  });
});
