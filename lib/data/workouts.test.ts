import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutFocus } from '@/types/fitness';
import {
  countWorkouts,
  mapWorkout,
  tallyWorkouts,
  type WorkoutRow,
  workoutsForToday,
} from './workouts';

const make = (memberId: string, date: string, focuses: WorkoutFocus[] = ['upper']): Workout => ({
  id: `${memberId}-${date}-${focuses.join('')}`,
  memberId,
  date,
  focuses,
  note: null,
});

describe('mapWorkout', () => {
  it('maps a row, keeping the focus list', () => {
    const row: WorkoutRow = {
      id: 'w1',
      member_id: 'm1',
      workout_date: '2026-09-25',
      focuses: ['push', 'cardio'],
      note: 'Felt strong',
    };

    expect(mapWorkout(row)).toEqual({
      id: 'w1',
      memberId: 'm1',
      date: '2026-09-25',
      focuses: ['push', 'cardio'],
      note: 'Felt strong',
    });
  });

  it('survives a null focus list rather than crashing the page', () => {
    const row = {
      id: 'w1',
      member_id: 'm1',
      workout_date: '2026-09-25',
      focuses: null,
      note: null,
    } as WorkoutRow;

    expect(mapWorkout(row).focuses).toEqual([]);
  });
});

describe('tallyWorkouts', () => {
  // Friday 25 Sep 2026. Its Sunday-start week began Sun 20 Sep.
  const today = '2026-09-25';

  it('counts today, the week and the month separately', () => {
    const tallies = tallyWorkouts(
      [
        make('m1', today),
        make('m1', '2026-09-22'), // same week
        make('m1', '2026-09-08'), // same month, earlier week
      ],
      today
    );

    expect(tallies.m1).toEqual({ today: 1, week: 2, month: 3 });
  });

  it('starts the week on Sunday, matching the playbook', () => {
    // Sun 20 Sep is in the week; Sat 19 Sep is the week before.
    const tallies = tallyWorkouts([make('m1', '2026-09-20'), make('m1', '2026-09-19')], today);

    expect(tallies.m1.week).toBe(1);
    expect(tallies.m1.month).toBe(2);
  });

  it('counts a workout in the week but not the month when the week straddles a month end', () => {
    // Thu 1 Oct 2026; its week began Sun 27 Sep, i.e. in September.
    const tallies = tallyWorkouts(
      [make('m1', '2026-09-28'), make('m1', '2026-10-01')],
      '2026-10-01'
    );

    expect(tallies.m1.week).toBe(2);
    expect(tallies.m1.month).toBe(1);
  });

  it('keeps members separate', () => {
    const tallies = tallyWorkouts(
      [make('m1', today), make('m2', today), make('m2', '2026-09-21')],
      today
    );

    expect(tallies.m1.week).toBe(1);
    expect(tallies.m2.week).toBe(2);
  });

  it('ignores a future date, so a typo cannot inflate the week', () => {
    const tallies = tallyWorkouts([make('m1', '2026-09-30'), make('m1', today)], today);

    expect(tallies.m1).toEqual({ today: 1, week: 1, month: 1 });
  });

  it('counts one multi-focus session as one workout, not one per focus', () => {
    const tallies = tallyWorkouts([make('m1', today, ['push', 'cardio', 'legs'])], today);

    expect(tallies.m1.week).toBe(1);
  });

  it('counts two sessions on the same day as two', () => {
    const tallies = tallyWorkouts(
      [make('m1', today, ['push']), make('m1', today, ['cardio'])],
      today
    );

    expect(tallies.m1).toEqual({ today: 2, week: 2, month: 2 });
  });

  it('has no entry for someone who has not trained', () => {
    expect(tallyWorkouts([], today).m1).toBeUndefined();
  });
});

describe('countWorkouts', () => {
  it('counts each session inside the selected Logs period', () => {
    const counts = countWorkouts(
      [
        make('m1', '2026-09-19'),
        make('m1', '2026-09-20'),
        make('m1', '2026-09-25'),
        make('m2', '2026-09-24'),
        make('m2', '2026-09-26'),
      ],
      '2026-09-20',
      '2026-09-25'
    );

    expect(counts).toEqual({ m1: 2, m2: 1 });
  });
});

describe('workoutsForToday', () => {
  it('returns only that member, only that day', () => {
    const all = [
      make('m1', '2026-09-25', ['push']),
      make('m1', '2026-09-24', ['pull']),
      make('m2', '2026-09-25', ['legs']),
    ];

    const mine = workoutsForToday(all, 'm1', '2026-09-25');

    expect(mine).toHaveLength(1);
    expect(mine[0].focuses).toEqual(['push']);
  });
});
