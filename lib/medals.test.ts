import { describe, expect, it } from 'vitest';
import type { DailyLog, MemberTargets } from '@/types/fitness';
import { buildMedalBoards } from './medals';

const targets: MemberTargets = {
  calories: 2500,
  protein: 156,
  carbs: 313,
  fat: 69,
  steps: 10000,
  stepsMin: 8000,
  waterMl: 2500,
  workoutsPerWeek: 4,
  sleepHours: 8,
};

const log = (date: string, steps: number): DailyLog => ({
  memberId: 'm1',
  date,
  steps,
  waterMl: 2500,
  calories: 2500,
  proteinG: 156,
  carbsG: 313,
  fatG: 69,
  sleepHours: 8,
});

describe('buildMedalBoards', () => {
  it('builds a day-only board before the week and month boards', () => {
    const boards = buildMedalBoards(
      [log('2026-09-26', 20000), log('2026-09-27', 10000)],
      [],
      '2026-09-27',
      { m1: targets }
    );

    expect(boards.map(({ period, label }) => ({ period, label }))).toEqual([
      { period: 'day', label: 'Today' },
      { period: 'week', label: 'This week' },
      { period: 'month', label: 'This month' },
    ]);
    expect(boards[0].awards.find((award) => award.category === 'totalSteps')).toMatchObject({
      memberId: 'm1',
      value: 10000,
    });
  });
});
