import type { DailyLog } from '@/types/fitness';

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
}

export const emptySummary: LogSummary = {
  daysLogged: 0,
  totalSteps: 0,
  avgSteps: 0,
  avgWaterMl: 0,
  avgCalories: 0,
  avgProteinG: 0,
};

/** A day counts as logged only if something was actually entered. */
const hasContent = (log: DailyLog) =>
  log.steps > 0 || log.waterMl > 0 || log.calories > 0 || log.proteinG > 0;

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
  }

  for (const summary of Object.values(byMember)) {
    const days = summary.daysLogged || 1;
    summary.avgSteps = Math.round(summary.avgSteps / days);
    summary.avgWaterMl = Math.round(summary.avgWaterMl / days);
    summary.avgCalories = Math.round(summary.avgCalories / days);
    summary.avgProteinG = Math.round(summary.avgProteinG / days);
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
