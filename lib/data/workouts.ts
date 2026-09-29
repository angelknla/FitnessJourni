import { startOfMonth, startOfWeek } from '@utils/date';
import { type DataScope, isEmptyScope } from '@/lib/data/scope';
import { getSupabase } from '@/lib/supabase/server';
import type { Workout, WorkoutFocus, WorkoutTally } from '@/types/fitness';

export interface WorkoutRow {
  id: string;
  member_id: string;
  workout_date: string;
  focuses: string[] | null;
  note: string | null;
}

export const mapWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  memberId: row.member_id,
  date: row.workout_date,
  focuses: (row.focuses ?? []) as WorkoutFocus[],
  note: row.note,
});

/**
 * Everything visible from `fromDate` onwards. One pass covers today, the week and
 * the month; the counts are derived in JS rather than three round trips.
 *
 * Visible means shared with the active group or belonging to the viewer — see the
 * note in lib/data/logs.ts for why that is two reads merged here rather than one.
 */
export const getWorkoutsSince = async (fromDate: string, scope: DataScope): Promise<Workout[]> => {
  const supabase = getSupabase();
  if (!supabase || isEmptyScope(scope)) {
    return [];
  }

  const results = await Promise.all([
    ...(scope.groupId
      ? [
          supabase
            .from('workouts')
            .select('*, group_workouts!inner(group_id)')
            .eq('group_workouts.group_id', scope.groupId)
            .gte('workout_date', fromDate),
        ]
      : []),
    ...(scope.memberId
      ? [
          supabase
            .from('workouts')
            .select('*')
            .eq('member_id', scope.memberId)
            .gte('workout_date', fromDate),
        ]
      : []),
  ]);

  const byId = new Map<string, Workout>();

  for (const result of results) {
    if (result.error) {
      console.error('[workouts] read failed:', result.error.message);
      continue;
    }
    for (const row of (result.data ?? []) as WorkoutRow[]) {
      byId.set(row.id, mapWorkout(row));
    }
  }

  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
};

export const countWorkouts = (
  workouts: Workout[],
  from: string,
  to: string
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const workout of workouts) {
    if (workout.date >= from && workout.date <= to) {
      counts[workout.memberId] = (counts[workout.memberId] ?? 0) + 1;
    }
  }

  return counts;
};

const emptyTally = (): WorkoutTally => ({ today: 0, week: 0, month: 0 });

/**
 * Counts per member for the day, the Monday-start week and the calendar month.
 * A workout can land in the week but not the month (or vice versa) when a week
 * straddles a month boundary, so each bucket is tested independently.
 */
export const tallyWorkouts = (workouts: Workout[], today: string): Record<string, WorkoutTally> => {
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const byMember: Record<string, WorkoutTally> = {};

  for (const workout of workouts) {
    // Ignore anything dated after today, so a mistyped future date cannot
    // inflate this week's count.
    if (workout.date > today) {
      continue;
    }

    let tally = byMember[workout.memberId];
    if (!tally) {
      tally = emptyTally();
      byMember[workout.memberId] = tally;
    }

    if (workout.date === today) {
      tally.today += 1;
    }
    if (workout.date >= weekStart) {
      tally.week += 1;
    }
    if (workout.date >= monthStart) {
      tally.month += 1;
    }
  }

  return byMember;
};

/** Today's workouts for one member, in the order they were logged. */
export const workoutsForToday = (workouts: Workout[], memberId: string, today: string): Workout[] =>
  workouts.filter((workout) => workout.memberId === memberId && workout.date === today);
