import { describe, expect, it } from 'vitest';
import { calculateBmi, mapProfile, mapWeightMeasurement } from './profile';

describe('profile data', () => {
  it('maps nullable profile decimals from Supabase', () => {
    expect(
      mapProfile({
        id: 'm1',
        age: 34,
        height_cm: '182.5',
        target_weight_kg: '84.0',
        target_bmi: null,
      })
    ).toEqual({
      memberId: 'm1',
      age: 34,
      heightCm: 182.5,
      targetWeightKg: 84,
      targetBmi: null,
    });
  });

  it('maps monthly weights and calculates BMI to one decimal place', () => {
    expect(mapWeightMeasurement({ month_start: '2026-09-01', weight_kg: '82.4' })).toEqual({
      month: '2026-09-01',
      weightKg: 82.4,
    });
    expect(calculateBmi(82.4, 182.5)).toBe(24.7);
  });

  it('does not calculate BMI without both measurements', () => {
    expect(calculateBmi(null, 180)).toBeNull();
    expect(calculateBmi(80, null)).toBeNull();
  });
});
