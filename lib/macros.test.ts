import { describe, expect, it } from 'vitest';
import { gramsFromPercents, kcalFromGrams, percentsFromGrams, percentTotal } from './macros';

describe('kcalFromGrams', () => {
  it('uses 4/4/9 per gram', () => {
    expect(kcalFromGrams({ protein: 100, carbs: 100, fat: 100 })).toBe(1700);
  });

  it('matches the playbook split', () => {
    // The playbook's 156/313/69 is billed as 2,500 kcal; whole grams make it 2,497.
    expect(kcalFromGrams({ protein: 156, carbs: 313, fat: 69 })).toBe(2497);
  });

  it('ignores negatives rather than subtracting calories', () => {
    expect(kcalFromGrams({ protein: -50, carbs: 100, fat: 0 })).toBe(400);
  });
});

describe('gramsFromPercents', () => {
  it('reproduces the playbook targets from 50/25/25 of 2,500', () => {
    expect(gramsFromPercents(2500, { protein: 25, carbs: 50, fat: 25 })).toEqual({
      protein: 156,
      carbs: 313,
      fat: 69,
    });
  });

  it('raises every gram figure when calories go up at a fixed split', () => {
    const lower = gramsFromPercents(2000, { protein: 25, carbs: 50, fat: 25 });
    const higher = gramsFromPercents(3000, { protein: 25, carbs: 50, fat: 25 });

    expect(higher.protein).toBeGreaterThan(lower.protein);
    expect(higher.carbs).toBeGreaterThan(lower.carbs);
    expect(higher.fat).toBeGreaterThan(lower.fat);
  });

  it('returns zeros for a nonsensical calorie figure', () => {
    expect(gramsFromPercents(0, { protein: 25, carbs: 50, fat: 25 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(gramsFromPercents(Number.NaN, { protein: 25, carbs: 50, fat: 25 }).protein).toBe(0);
  });

  it('treats a negative percentage as zero', () => {
    expect(gramsFromPercents(2000, { protein: -10, carbs: 50, fat: 25 }).protein).toBe(0);
  });
});

describe('percentsFromGrams', () => {
  it('describes the split the grams actually represent', () => {
    expect(percentsFromGrams({ protein: 156, carbs: 313, fat: 69 })).toEqual({
      protein: 25,
      carbs: 50,
      fat: 25,
    });
  });

  it('round-trips a clean split', () => {
    const grams = gramsFromPercents(2400, { protein: 30, carbs: 40, fat: 30 });

    expect(percentsFromGrams(grams)).toEqual({ protein: 30, carbs: 40, fat: 30 });
  });

  it('returns zeros rather than dividing by zero', () => {
    expect(percentsFromGrams({ protein: 0, carbs: 0, fat: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe('percentTotal', () => {
  it('sums the three', () => {
    expect(percentTotal({ protein: 25, carbs: 50, fat: 25 })).toBe(100);
  });

  it('exposes a split that does not add up', () => {
    expect(percentTotal({ protein: 40, carbs: 50, fat: 25 })).toBe(115);
  });
});
