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

const log = (
  memberId: string,
  date: string,
  steps: number,
  overrides: Partial<DailyLog> = {}
): DailyLog => ({
  memberId,
  date,
  steps,
  waterMl: 2500,
  calories: 2500,
  proteinG: 156,
  carbsG: 313,
  fatG: 69,
  sleepHours: 8,
  ...overrides,
});

describe('buildMedalBoards', () => {
  it('builds a day-only board before the week and month boards', () => {
    const boards = buildMedalBoards(
      [
        log('m1', '2026-09-26', 20000),
        log('m1', '2026-09-27', 10000),
        log('m2', '2026-09-27', 6000),
      ],
      [],
      '2026-09-27',
      { m1: targets, m2: targets }
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

  it('labels a historical day with its date', () => {
    const [day] = buildMedalBoards([], [], '2026-09-20', {}, '2026-09-27');

    expect(day.label).toBe('20 Sept 2026');
  });

  it('awards medals when one member qualifies', () => {
    const [today] = buildMedalBoards([log('m1', '2026-09-27', 10000)], [], '2026-09-27', {
      m1: targets,
    });

    expect(today.awards.length).toBeGreaterThan(0);
    expect(today.awards.every((award) => award.memberId === 'm1')).toBe(true);
    expect(today.awards.every((award) => award.rank === 'gold')).toBe(true);
  });

  it('accepts the 30% completion and 50% closeness boundaries', () => {
    const boundaryLog = (memberId: string) =>
      log(memberId, '2026-09-27', 3000, {
        waterMl: 750,
        calories: 1250,
        proteinG: 78,
        sleepHours: 4,
      });
    const [today] = buildMedalBoards([boundaryLog('m1'), boundaryLog('m2')], [], '2026-09-27', {
      m1: targets,
      m2: targets,
    });

    expect(new Set(today.awards.map((award) => award.category))).toEqual(
      new Set([
        'daysLogged',
        'totalSteps',
        'avgSteps',
        'avgWaterMl',
        'avgSleepHours',
        'nutritionTarget',
      ])
    );
  });

  it('rejects target categories below the qualification boundaries', () => {
    const belowThresholdLog = (memberId: string) =>
      log(memberId, '2026-09-27', 2999, {
        waterMl: 749,
        calories: 1200,
        proteinG: 75,
        sleepHours: 3.9,
      });
    const [today] = buildMedalBoards(
      [belowThresholdLog('m1'), belowThresholdLog('m2')],
      [],
      '2026-09-27',
      { m1: targets, m2: targets }
    );
    const categories = new Set(today.awards.map((award) => award.category));

    expect(categories).toEqual(new Set(['daysLogged']));
  });
});
