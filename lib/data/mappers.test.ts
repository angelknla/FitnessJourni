import { describe, expect, it } from 'vitest';
import { type DailyLogRow, emptyLog, getLogsForDate, mapLog } from './logs';
import { getMembers, type MemberRow, mapMember } from './members';
import { getUpcomingSessions, mapSession, type SessionRow } from './sessions';

const memberRow: MemberRow = {
  id: 'm1',
  name: 'Dillon',
  surname: null,
  accent: 'blue',
  avatar_path: null,
  sort_order: 0,
  target_calories: 2500,
  target_protein: 156,
  target_carbs: 313,
  target_fat: 69,
  target_steps: 10000,
  target_steps_min: 8000,
  target_water_ml: 2500,
  target_workouts_per_week: 4,
};

describe('mapMember', () => {
  it('converts a row into camelCase with nested targets', () => {
    expect(mapMember(memberRow)).toEqual({
      id: 'm1',
      firstName: 'Dillon',
      surname: null,
      name: 'Dillon',
      accent: 'blue',
      avatarPath: null,
      sortOrder: 0,
      targets: {
        calories: 2500,
        protein: 156,
        carbs: 313,
        fat: 69,
        steps: 10000,
        stepsMin: 8000,
        waterMl: 2500,
        sleepHours: 8,
        workoutsPerWeek: 4,
      },
    });
  });

  it('keeps surname separate from the shared display name', () => {
    expect(mapMember({ ...memberRow, surname: 'Smith' })).toMatchObject({
      firstName: 'Dillon',
      surname: 'Smith',
      name: 'Dillon',
    });
  });

  it('maps a selected local avatar path', () => {
    expect(mapMember({ ...memberRow, avatar_path: '/avatars/tempo.svg' }).avatarPath).toBe(
      '/avatars/tempo.svg'
    );
  });
});

describe('mapLog', () => {
  it('converts a row into camelCase', () => {
    const row: DailyLogRow = {
      member_id: 'm1',
      log_date: '2026-09-25',
      steps: 9120,
      water_ml: 2000,
      calories: 2430,
      protein_g: 150,
      carbs_g: 300,
      fat_g: 65,
      sleep_hours: 7.5,
    };

    expect(mapLog(row)).toEqual({
      memberId: 'm1',
      date: '2026-09-25',
      steps: 9120,
      waterMl: 2000,
      calories: 2430,
      proteinG: 150,
      carbsG: 300,
      fatG: 65,
      sleepHours: 7.5,
    });
  });

  it('treats a not-yet-migrated sleep column as not logged', () => {
    const row: DailyLogRow = {
      member_id: 'm1',
      log_date: '2026-09-25',
      steps: 9120,
      water_ml: 2000,
      calories: 2430,
      protein_g: 150,
      carbs_g: 300,
      fat_g: 65,
    };

    expect(mapLog(row).sleepHours).toBeNull();
  });
});

describe('emptyLog', () => {
  it('zeroes every metric, so an untouched day renders as a real state', () => {
    expect(emptyLog('m1', '2026-09-25')).toEqual({
      memberId: 'm1',
      date: '2026-09-25',
      steps: 0,
      waterMl: 0,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      sleepHours: null,
    });
  });
});

describe('mapSession', () => {
  it('shortens the time and passes the rest through', () => {
    const row: SessionRow = {
      id: 's1',
      session_date: '2026-09-26',
      session_time: '07:30:00',
      activity: 'run',
      note: 'Park gate',
      created_by: 'm1',
    };

    expect(mapSession(row)).toEqual({
      id: 's1',
      date: '2026-09-26',
      time: '07:30',
      activity: 'run',
      note: 'Park gate',
      createdBy: 'm1',
      rsvps: [],
    });
  });
});

/**
 * No SUPABASE_URL / SUPABASE_ANON_KEY is set in the test environment, so these
 * exercise the unconfigured path the setup notice depends on.
 */
describe('reads without a configured client', () => {
  it('returns empty collections rather than throwing', async () => {
    await expect(getMembers()).resolves.toEqual([]);
    await expect(getLogsForDate('2026-09-25', { groupId: 'g1', memberId: 'm1' })).resolves.toEqual(
      {}
    );
    await expect(getUpcomingSessions('2026-09-25', 'g1')).resolves.toEqual([]);
  });
});

describe('resolveAccent via mapMember', () => {
  it('keeps a recognised accent', () => {
    expect(mapMember({ ...memberRow, accent: 'orange', sort_order: 1 }).accent).toBe('orange');
  });

  it('falls back by position for an unknown accent, keeping members distinct', () => {
    expect(mapMember({ ...memberRow, accent: 'chartreuse', sort_order: 0 }).accent).toBe('blue');
    expect(mapMember({ ...memberRow, accent: 'sky', sort_order: 1 }).accent).toBe('orange');
    expect(mapMember({ ...memberRow, accent: 'amber', sort_order: 2 }).accent).toBe('aqua');
  });
});

describe('target fallbacks', () => {
  it('falls back to the playbook defaults for a column not yet migrated', () => {
    const partial = {
      ...memberRow,
      target_workouts_per_week: null,
      target_sleep_hours: null,
    } as MemberRow;

    expect(mapMember(partial).targets.workoutsPerWeek).toBe(4);
    expect(mapMember(partial).targets.sleepHours).toBe(8);
  });

  it('never yields a zero target, which would make a meter read "of 0"', () => {
    const blank = {
      id: 'm1',
      name: 'Dillon',
      accent: 'blue',
      sort_order: 0,
      target_calories: null,
      target_protein: null,
      target_carbs: null,
      target_fat: null,
      target_steps: null,
      target_steps_min: null,
      target_water_ml: null,
      target_workouts_per_week: null,
    } as MemberRow;

    for (const value of Object.values(mapMember(blank).targets)) {
      expect(value).toBeGreaterThan(0);
    }
  });
});
