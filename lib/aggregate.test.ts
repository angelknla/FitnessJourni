import { describe, expect, it } from 'vitest';
import type { DailyLog, MemberTargets } from '@/types/fitness';
import {
  awardMedals,
  leaders,
  nutritionTargetScore,
  sleepTargetScore,
  summarise,
} from './aggregate';

const targets = (calories: number, protein: number): MemberTargets => ({
  calories,
  protein,
  carbs: 300,
  fat: 70,
  steps: 10000,
  stepsMin: 8000,
  waterMl: 2500,
  workoutsPerWeek: 4,
});

const log = (memberId: string, date: string, over: Partial<DailyLog> = {}): DailyLog => ({
  memberId,
  date,
  steps: 10000,
  waterMl: 2000,
  calories: 2400,
  proteinG: 150,
  carbsG: 300,
  fatG: 60,
  sleepHours: null,
  ...over,
});

describe('summarise', () => {
  it('totals steps and averages the rest over days logged', () => {
    const summaries = summarise(
      [
        log('m1', '2026-09-21', { steps: 8000, waterMl: 1000, calories: 2000, proteinG: 100 }),
        log('m1', '2026-09-22', { steps: 12000, waterMl: 3000, calories: 2400, proteinG: 200 }),
      ],
      '2026-09-20',
      '2026-09-25'
    );

    expect(summaries.m1).toEqual({
      daysLogged: 2,
      totalSteps: 20000,
      avgSteps: 10000,
      avgWaterMl: 2000,
      avgCalories: 2200,
      avgProteinG: 150,
      sleepDaysLogged: 0,
      avgSleepHours: 0,
    });
  });

  it('averages sleep only across days with sleep recorded', () => {
    const summaries = summarise(
      [
        log('m1', '2026-09-21', { sleepHours: 7 }),
        log('m1', '2026-09-22', { sleepHours: 8 }),
        log('m1', '2026-09-23', { sleepHours: null }),
      ],
      '2026-09-20',
      '2026-09-25'
    );

    expect(summaries.m1.sleepDaysLogged).toBe(2);
    expect(summaries.m1.avgSleepHours).toBe(7.5);
  });

  it('averages nutrition only across days where each value was entered', () => {
    const summaries = summarise(
      [
        log('m1', '2026-09-21', { calories: 2000, proteinG: 100 }),
        log('m1', '2026-09-22', { calories: 0, proteinG: 0 }),
      ],
      '2026-09-20',
      '2026-09-25'
    );

    expect(summaries.m1.avgCalories).toBe(2000);
    expect(summaries.m1.avgProteinG).toBe(100);
  });

  it('ignores days outside the window', () => {
    const summaries = summarise(
      [log('m1', '2026-09-19'), log('m1', '2026-09-21'), log('m1', '2026-09-26')],
      '2026-09-20',
      '2026-09-25'
    );

    expect(summaries.m1.daysLogged).toBe(1);
  });

  it('does not count an all-zero row as a logged day', () => {
    const summaries = summarise(
      [log('m1', '2026-09-21', { steps: 0, waterMl: 0, calories: 0, proteinG: 0 })],
      '2026-09-20',
      '2026-09-25'
    );

    expect(summaries.m1).toBeUndefined();
  });

  it('keeps members apart', () => {
    const summaries = summarise(
      [log('m1', '2026-09-21', { steps: 5000 }), log('m2', '2026-09-21', { steps: 15000 })],
      '2026-09-20',
      '2026-09-25'
    );

    expect(summaries.m1.totalSteps).toBe(5000);
    expect(summaries.m2.totalSteps).toBe(15000);
  });

  it('does not divide by zero', () => {
    expect(summarise([], '2026-09-20', '2026-09-25')).toEqual({});
  });
});

describe('leaders', () => {
  const summaries = {
    m1: {
      daysLogged: 5,
      totalSteps: 50000,
      avgSteps: 10000,
      avgWaterMl: 2000,
      avgCalories: 3000,
      avgProteinG: 150,
      sleepDaysLogged: 5,
      avgSleepHours: 8,
    },
    m2: {
      daysLogged: 3,
      totalSteps: 60000,
      avgSteps: 20000,
      avgWaterMl: 2000,
      avgCalories: 2000,
      avgProteinG: 100,
      sleepDaysLogged: 3,
      avgSleepHours: 7,
    },
  };

  it('picks the highest for each ranked metric', () => {
    const result = leaders(summaries);

    expect(result.daysLogged).toEqual(['m1']);
    expect(result.totalSteps).toEqual(['m2']);
    expect(result.avgSteps).toEqual(['m2']);
    expect(result.avgProteinG).toEqual(['m1']);
  });

  it('returns everyone on a tie', () => {
    expect(leaders(summaries).avgWaterMl).toEqual(['m1', 'm2']);
  });

  it('never ranks calories, because a budget has no winner', () => {
    expect(leaders(summaries)).not.toHaveProperty('avgCalories');
  });

  it('has no leader for a metric nobody scored on', () => {
    const none = {
      m1: { ...summaries.m1, totalSteps: 0, avgSteps: 0 },
      m2: { ...summaries.m2, totalSteps: 0, avgSteps: 0 },
    };

    expect(leaders(none).totalSteps).toEqual([]);
  });
});

describe('awardMedals', () => {
  const summary = (steps: number): ReturnType<typeof summarise>[string] => ({
    daysLogged: steps / 1000,
    totalSteps: steps,
    avgSteps: steps,
    avgWaterMl: steps,
    avgCalories: 0,
    avgProteinG: 0,
    sleepDaysLogged: 1,
    avgSleepHours: steps / 1000,
  });

  it('awards a podium per category and includes workout-only members', () => {
    const awards = awardMedals(
      { m1: summary(3000), m2: summary(2000), m3: summary(1000), m4: summary(0) },
      { m1: 1, m2: 2, m3: 3, m4: 4 }
    );

    expect(
      awards
        .filter((award) => award.category === 'totalSteps')
        .map(({ memberId, medal }) => [memberId, medal])
    ).toEqual([
      ['m1', '🥇'],
      ['m2', '🥈'],
      ['m3', '🥉'],
    ]);
    expect(
      awards.find((award) => award.category === 'workouts' && award.memberId === 'm4')?.medal
    ).toBe('🥇');
  });

  it('shares medals on ties and skips the next podium place', () => {
    const awards = awardMedals(
      { m1: summary(3000), m2: summary(3000), m3: summary(2000), m4: summary(1000) },
      {}
    ).filter((award) => award.category === 'totalSteps');

    expect(awards.map(({ memberId, medal }) => [memberId, medal])).toEqual([
      ['m1', '🥇'],
      ['m2', '🥇'],
      ['m3', '🥉'],
    ]);
  });

  it('does not award medals for zero scores', () => {
    expect(awardMedals({}, {})).toEqual([]);
  });

  it('ranks nutrition by closeness to each member’s own calorie and protein targets', () => {
    const first = { ...summary(1000), avgCalories: 2000, avgProteinG: 120 };
    const second = { ...summary(1000), avgCalories: 3000, avgProteinG: 180 };
    const awards = awardMedals(
      { m1: first, m2: second },
      {},
      { m1: targets(2000, 120), m2: targets(3000, 180) }
    ).filter((award) => award.category === 'nutritionTarget');

    expect(awards.map(({ memberId, medal, value }) => [memberId, medal, value])).toEqual([
      ['m1', '🥇', 100],
      ['m2', '🥇', 100],
    ]);
  });

  it('ranks sleep by closeness to personal targets rather than most hours', () => {
    const sevenHours = { ...summary(1000), avgSleepHours: 7 };
    const eightHours = { ...summary(1000), avgSleepHours: 8 };
    const awards = awardMedals(
      { m1: sevenHours, m2: eightHours },
      {},
      {
        m1: { ...targets(2000, 100), sleepHours: 7 },
        m2: { ...targets(2000, 100), sleepHours: 10 },
      }
    ).filter((award) => award.category === 'avgSleepHours');

    expect(awards.map(({ memberId, medal, value }) => [memberId, medal, value])).toEqual([
      ['m1', '🥇', 100],
      ['m2', '🥈', 80],
    ]);
  });
});

describe('nutritionTargetScore', () => {
  const summary = {
    daysLogged: 1,
    totalSteps: 0,
    avgSteps: 0,
    avgWaterMl: 0,
    avgCalories: 0,
    avgProteinG: 0,
    sleepDaysLogged: 0,
    avgSleepHours: 0,
  };

  it('scores equal under and over target misses identically', () => {
    const memberTargets = targets(2000, 100);
    const under = nutritionTargetScore(
      { ...summary, avgCalories: 1800, avgProteinG: 90 },
      memberTargets
    );
    const over = nutritionTargetScore(
      { ...summary, avgCalories: 2200, avgProteinG: 110 },
      memberTargets
    );

    expect(under).toBe(90);
    expect(over).toBe(90);
  });

  it('does not score incomplete nutrition logging', () => {
    expect(nutritionTargetScore({ ...summary, avgCalories: 2000 }, targets(2000, 100))).toBe(0);
  });

  it('scores calories against the base target regardless of calories burned from steps', () => {
    const score = nutritionTargetScore(
      {
        ...summary,
        totalSteps: 20000,
        avgSteps: 20000,
        avgCalories: 2000,
        avgProteinG: 100,
      },
      targets(2000, 100)
    );

    expect(score).toBe(100);
  });
});

describe('sleepTargetScore', () => {
  const summary = {
    daysLogged: 1,
    totalSteps: 0,
    avgSteps: 0,
    avgWaterMl: 0,
    avgCalories: 0,
    avgProteinG: 0,
    sleepDaysLogged: 1,
    avgSleepHours: 7,
  };

  it('uses each member’s target and treats equal under and over misses alike', () => {
    expect(sleepTargetScore(summary, targets(2000, 100))).toBe(88);
    expect(
      sleepTargetScore({ ...summary, avgSleepHours: 9 }, { ...targets(2000, 100), sleepHours: 8 })
    ).toBe(88);
    expect(sleepTargetScore(summary, { ...targets(2000, 100), sleepHours: 7 })).toBe(100);
  });

  it('uses the default 8-hour target and does not score missing sleep', () => {
    expect(sleepTargetScore(summary, targets(2000, 100))).toBe(88);
    expect(sleepTargetScore({ ...summary, avgSleepHours: 0 }, targets(2000, 100))).toBe(0);
  });
});
