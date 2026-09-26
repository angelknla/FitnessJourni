import { describe, expect, it } from 'vitest';
import type { GroupRun } from '@/types/fitness';
import { formatRunDuration, formatRunPace, mapRun, tallyRuns } from './runs';

const run = (date: string, attendeeIds: string[]): GroupRun => ({
  id: `${date}-${attendeeIds.join('-')}`,
  date,
  durationMinutes: 30,
  distanceKm: 5,
  paceSecondsPerKm: null,
  createdBy: attendeeIds[0] ?? null,
  attendeeIds,
});

describe('mapRun', () => {
  it('maps numeric strings and nested attendees', () => {
    expect(
      mapRun({
        id: 'r1',
        run_date: '2026-09-25',
        duration_minutes: '31.5',
        distance_km: '5.25',
        pace_seconds_per_km: 350,
        created_by: 'm1',
        run_attendees: [{ member_id: 'm1' }, { member_id: 'm2' }],
      })
    ).toEqual({
      id: 'r1',
      date: '2026-09-25',
      durationMinutes: 31.5,
      distanceKm: 5.25,
      paceSecondsPerKm: 350,
      createdBy: 'm1',
      attendeeIds: ['m1', 'm2'],
    });
  });
});

describe('tallyRuns', () => {
  it('counts every attendee independently across week and month boundaries', () => {
    const tallies = tallyRuns(
      [run('2026-09-25', ['m1', 'm2']), run('2026-09-20', ['m1']), run('2026-09-01', ['m2'])],
      '2026-09-25'
    );

    expect(tallies.m1).toEqual({ week: 1, month: 2 });
    expect(tallies.m2).toEqual({ week: 1, month: 2 });
  });

  it('ignores future runs and duplicate attendee IDs', () => {
    expect(
      tallyRuns([run('2026-09-26', ['m1']), run('2026-09-25', ['m1', 'm1'])], '2026-09-25')
    ).toEqual({
      m1: { week: 1, month: 1 },
    });
  });
});

describe('run formatting', () => {
  it('formats elapsed time and pace', () => {
    expect(formatRunDuration(65)).toBe('1h 05m');
    expect(formatRunDuration(42)).toBe('42m');
    expect(formatRunDuration(31.5)).toBe('31.5m');
    expect(formatRunDuration(65.5)).toBe('1h 05.5m');
    expect(formatRunPace(31, 5)).toBe('6:12 /km');
    expect(formatRunPace(31, 5, 345)).toBe('5:45 /km');
  });
});
