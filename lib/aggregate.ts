import type { DailyLog, MemberTargets } from '@/types/fitness';

export type Period = 'today' | 'week' | 'month';

export interface LogSummary {
  /**
   * How many days this member actually recorded. Shown alongside every average
   * because an average over one good day is not the same achievement as an
   * average over seven — and consistency is the thing the playbook cares about.
   */
  daysLogged: number;
  totalSteps: number;
  avgSteps: number;
  avgWaterMl: number;
  avgCalories: number;
  avgProteinG: number;
  sleepDaysLogged: number;
  avgSleepHours: number;
}

export const emptySummary: LogSummary = {
  daysLogged: 0,
  totalSteps: 0,
  avgSteps: 0,
  avgWaterMl: 0,
  avgCalories: 0,
  avgProteinG: 0,
  sleepDaysLogged: 0,
  avgSleepHours: 0,
};

/** A day counts as logged only if something was actually entered. */
const hasContent = (log: DailyLog) =>
  log.steps > 0 ||
  log.waterMl > 0 ||
  log.calories > 0 ||
  log.proteinG > 0 ||
  log.sleepHours !== null;

/**
 * Per-member summaries over the given window. Averages divide by days logged,
 * not days elapsed, so someone who logs four days is not averaged down by the
 * three they missed — `daysLogged` is what exposes that.
 */
export const summarise = (
  logs: DailyLog[],
  from: string,
  to: string
): Record<string, LogSummary> => {
  const byMember: Record<string, LogSummary> = {};
  const calorieDaysByMember: Record<string, number> = {};
  const proteinDaysByMember: Record<string, number> = {};

  for (const log of logs) {
    if (log.date < from || log.date > to || !hasContent(log)) {
      continue;
    }

    let summary = byMember[log.memberId];
    if (!summary) {
      summary = { ...emptySummary };
      byMember[log.memberId] = summary;
    }

    summary.daysLogged += 1;
    summary.totalSteps += log.steps;
    // Accumulate into the average fields; divided through below.
    summary.avgSteps += log.steps;
    summary.avgWaterMl += log.waterMl;
    summary.avgCalories += log.calories;
    summary.avgProteinG += log.proteinG;
    if (log.calories > 0)
      calorieDaysByMember[log.memberId] = (calorieDaysByMember[log.memberId] ?? 0) + 1;
    if (log.proteinG > 0)
      proteinDaysByMember[log.memberId] = (proteinDaysByMember[log.memberId] ?? 0) + 1;
    if (log.sleepHours !== null) {
      summary.sleepDaysLogged += 1;
      summary.avgSleepHours += log.sleepHours;
    }
  }

  for (const [memberId, summary] of Object.entries(byMember)) {
    const days = summary.daysLogged || 1;
    summary.avgSteps = Math.round(summary.avgSteps / days);
    summary.avgWaterMl = Math.round(summary.avgWaterMl / days);
    summary.avgCalories = Math.round(summary.avgCalories / (calorieDaysByMember[memberId] || 1));
    summary.avgProteinG = Math.round(summary.avgProteinG / (proteinDaysByMember[memberId] || 1));
    const sleepDays = summary.sleepDaysLogged || 1;
    summary.avgSleepHours = Math.round((summary.avgSleepHours / sleepDays) * 100) / 100;
  }

  return byMember;
};

/**
 * Metrics where a higher number is unambiguously better, so a leader badge is
 * meaningful. Calories are deliberately absent: that is a budget, and "most
 * calories" is not a win.
 */
export type RankedMetric = 'daysLogged' | 'totalSteps' | 'avgSteps' | 'avgWaterMl' | 'avgProteinG';

export const rankedMetrics: RankedMetric[] = [
  'daysLogged',
  'totalSteps',
  'avgSteps',
  'avgWaterMl',
  'avgProteinG',
];

/**
 * Who leads each ranked metric. Ties return every tied member, and a metric
 * nobody has scored on has no leader at all.
 */
export const leaders = (summaries: Record<string, LogSummary>): Record<RankedMetric, string[]> => {
  const result = {} as Record<RankedMetric, string[]>;

  for (const metric of rankedMetrics) {
    let best = 0;
    let holders: string[] = [];

    for (const [memberId, summary] of Object.entries(summaries)) {
      const value = summary[metric];
      if (value <= 0) {
        continue;
      }
      if (value > best) {
        best = value;
        holders = [memberId];
      } else if (value === best) {
        holders.push(memberId);
      }
    }

    result[metric] = holders;
  }

  return result;
};

export type MedalRank = 'gold' | 'silver' | 'bronze';
export type MedalEmoji = '🥇' | '🥈' | '🥉';
export type MedalCategory =
  | 'daysLogged'
  | 'workouts'
  | 'totalSteps'
  | 'avgSteps'
  | 'avgWaterMl'
  | 'avgSleepHours'
  | 'nutritionTarget';

export interface MedalAward {
  memberId: string;
  category: MedalCategory;
  categoryLabel: string;
  rank: MedalRank;
  medal: MedalEmoji;
  value: number;
}

export interface MedalQualification {
  minimumCompetitors: number;
  targetCompletion: number;
  targetCloseness: number;
}

const podium = [
  { rank: 'gold', medal: '🥇' },
  { rank: 'silver', medal: '🥈' },
  { rank: 'bronze', medal: '🥉' },
] as const;

const targetCloseness = (value: number, target: number): number =>
  target > 0 ? Math.max(0, 100 - (Math.abs(value - target) / target) * 100) : 0;

export const nutritionTargetScore = (
  summary: LogSummary,
  targets: MemberTargets | undefined
): number => {
  if (!targets || summary.avgCalories <= 0 || summary.avgProteinG <= 0) return 0;
  return Math.round(
    (targetCloseness(summary.avgCalories, targets.calories) +
      targetCloseness(summary.avgProteinG, targets.protein)) /
      2
  );
};

export const sleepTargetScore = (
  summary: LogSummary,
  targets: MemberTargets | undefined
): number => {
  if (!targets || summary.avgSleepHours <= 0) return 0;
  return Math.round(targetCloseness(summary.avgSleepHours, targets.sleepHours ?? 8));
};

const medalCategories: {
  key: MedalCategory;
  label: string;
  value: (summary: LogSummary, workouts: number, targets?: MemberTargets) => number;
}[] = [
  { key: 'daysLogged', label: 'Logging', value: (summary) => summary.daysLogged },
  { key: 'workouts', label: 'Workouts', value: (_summary, workouts) => workouts },
  { key: 'totalSteps', label: 'Steps', value: (summary) => summary.totalSteps },
  { key: 'avgSteps', label: 'Steps/day', value: (summary) => summary.avgSteps },
  { key: 'avgWaterMl', label: 'Water/day', value: (summary) => summary.avgWaterMl },
  {
    key: 'avgSleepHours',
    label: 'Sleep/day',
    value: (summary, _workouts, targets) => sleepTargetScore(summary, targets),
  },
  {
    key: 'nutritionTarget',
    label: 'Nutrition',
    value: (summary, _workouts, targets) => nutritionTargetScore(summary, targets),
  },
];

const qualifiesForMedal = (
  category: MedalCategory,
  summary: LogSummary,
  workouts: number,
  targets: MemberTargets | undefined,
  qualification: MedalQualification
) => {
  switch (category) {
    case 'daysLogged':
      return summary.daysLogged > 0;
    case 'workouts':
      return workouts >= 1;
    case 'totalSteps':
    case 'avgSteps':
      return Boolean(targets && summary.avgSteps >= targets.steps * qualification.targetCompletion);
    case 'avgWaterMl':
      return Boolean(
        targets && summary.avgWaterMl >= targets.waterMl * qualification.targetCompletion
      );
    case 'avgSleepHours':
      return sleepTargetScore(summary, targets) >= qualification.targetCloseness;
    case 'nutritionTarget':
      return nutritionTargetScore(summary, targets) >= qualification.targetCloseness;
  }
};

/** Podium awards for each category. Ties share a medal and skip the next place. */
export const awardMedals = (
  summaries: Record<string, LogSummary>,
  workoutCounts: Record<string, number>,
  targetsByMember: Record<string, MemberTargets> = {},
  qualification?: MedalQualification
): MedalAward[] => {
  const memberIds = new Set([...Object.keys(summaries), ...Object.keys(workoutCounts)]);
  const awards: MedalAward[] = [];

  for (const category of medalCategories) {
    const scores = [...memberIds]
      .map((memberId) => {
        const summary = summaries[memberId] ?? emptySummary;
        const workouts = workoutCounts[memberId] ?? 0;
        const targets = targetsByMember[memberId];
        return {
          memberId,
          value: category.value(summary, workouts, targets),
          qualified:
            !qualification ||
            qualifiesForMedal(category.key, summary, workouts, targets, qualification),
        };
      })
      .filter((score) => score.value > 0 && score.qualified)
      .sort(
        (left, right) => right.value - left.value || left.memberId.localeCompare(right.memberId)
      );

    if (qualification && scores.length < qualification.minimumCompetitors) {
      continue;
    }

    let previousValue: number | null = null;
    let rankIndex = 0;

    scores.forEach((score, index) => {
      if (score.value !== previousValue) {
        rankIndex = index;
        previousValue = score.value;
      }

      const place = podium[rankIndex];
      if (!place) {
        return;
      }

      awards.push({
        memberId: score.memberId,
        category: category.key,
        categoryLabel: category.label,
        rank: place.rank,
        medal: place.medal,
        value: score.value,
      });
    });
  }

  return awards;
};
