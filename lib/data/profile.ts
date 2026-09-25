import { getSupabase } from '@/lib/supabase/server';
import type { MemberProfile, WeightMeasurement } from '@/types/fitness';

export interface ProfileRow {
  id: string;
  age: number | null;
  height_cm: number | string | null;
  target_weight_kg: number | string | null;
  target_bmi: number | string | null;
}

export interface WeightMeasurementRow {
  month_start: string;
  weight_kg: number | string;
}

const nullableNumber = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

export const mapProfile = (row: ProfileRow): MemberProfile => ({
  memberId: row.id,
  age: row.age,
  heightCm: nullableNumber(row.height_cm),
  targetWeightKg: nullableNumber(row.target_weight_kg),
  targetBmi: nullableNumber(row.target_bmi),
});

export const mapWeightMeasurement = (row: WeightMeasurementRow): WeightMeasurement => ({
  month: row.month_start,
  weightKg: Number(row.weight_kg),
});

export const calculateBmi = (weightKg: number | null, heightCm: number | null): number | null => {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightMetres = heightCm / 100;
  return Math.round((weightKg / heightMetres ** 2) * 10) / 10;
};

export const getProfile = async (
  memberId: string
): Promise<{ profile: MemberProfile; measurements: WeightMeasurement[] } | null> => {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const [profileResult, measurementResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, age, height_cm, target_weight_kg, target_bmi')
      .eq('id', memberId)
      .single(),
    supabase
      .from('weight_measurements')
      .select('month_start, weight_kg')
      .eq('member_id', memberId)
      .order('month_start', { ascending: true }),
  ]);

  if (profileResult.error || measurementResult.error) {
    console.error(
      '[profile] read failed:',
      profileResult.error?.message ?? measurementResult.error?.message
    );
    return null;
  }

  return {
    profile: mapProfile(profileResult.data as ProfileRow),
    measurements: (measurementResult.data as WeightMeasurementRow[]).map(mapWeightMeasurement),
  };
};
