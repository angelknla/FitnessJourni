import { describe, expect, it } from 'vitest';
import type { DailyLog } from '@/types/fitness';
import { leaders, summarise } from './aggregate';

const log = (memberId: string, date: string, over: Partial<DailyLog> = {}): DailyLog => ({
  memberId,
  date,
  steps: 10000,
  waterMl: 2000,
  calories: 2400,
  proteinG: 150,
  carbsG: 300,
  fatG: 60,
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
    });
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
    },
    m2: {
      daysLogged: 3,
      totalSteps: 60000,
      avgSteps: 20000,
      avgWaterMl: 2000,
      avgCalories: 2000,
      avgProteinG: 100,
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
