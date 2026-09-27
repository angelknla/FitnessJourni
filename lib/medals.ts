import { startOfMonth, startOfWeek } from '@utils/date';
import { awardMedals, type MedalAward, summarise } from '@/lib/aggregate';
import { countWorkouts } from '@/lib/data/workouts';
import type { DailyLog, MemberTargets, Workout } from '@/types/fitness';

const leaderboardQualification = {
  minimumCompetitors: 2,
  targetCompletion: 0.2,
  targetCloseness: 40,
};

export interface MedalBoard {
  period: 'day' | 'week' | 'month';
  label: string;
  awards: MedalAward[];
}

const medalDayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export const medalFetchStart = (date: string) => {
  const week = startOfWeek(date);
  const month = startOfMonth(date);
  return week < month ? week : month;
};

export const buildMedalBoards = (
  logs: DailyLog[],
  workouts: Workout[],
  through: string,
  targetsByMember: Record<string, MemberTargets> = {},
  today = through
): MedalBoard[] =>
  [
    {
      period: 'day' as const,
      label: through === today ? 'Today' : medalDayLabel.format(new Date(`${through}T12:00:00`)),
      from: through,
    },
    { period: 'week' as const, label: 'This week', from: startOfWeek(through) },
    { period: 'month' as const, label: 'This month', from: startOfMonth(through) },
  ].map(({ period, label, from }) => ({
    period,
    label,
    awards: awardMedals(
      summarise(logs, from, through),
      countWorkouts(workouts, from, through),
      targetsByMember,
      leaderboardQualification
    ),
  }));
