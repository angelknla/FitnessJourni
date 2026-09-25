import { startOfMonth, startOfWeek } from '@utils/date';
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
 * Everything from `fromDate` onwards. One query covers today, the week and the
 * month; the counts are derived in JS rather than three round trips.
 */
export const getWorkoutsSince = async (fromDate: string): Promise<Workout[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .gte('workout_date', fromDate)
    .order('workout_date', { ascending: false });

  if (error) {
    console.error('[workouts] read failed:', error.message);
    return [];
  }

  return (data as WorkoutRow[]).map(mapWorkout);
};

const emptyTally = (): WorkoutTally => ({ today: 0, week: 0, month: 0 });

/**
 * Counts per member for the day, the Sunday-start week and the calendar month.
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
