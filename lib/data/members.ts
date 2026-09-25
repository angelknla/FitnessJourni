import { resolveAccent } from '@data/fitnessData';
import { getSupabase } from '@/lib/supabase/server';
import type { Member } from '@/types/fitness';

export interface MemberRow {
  id: string;
  name: string;
  accent: string;
  sort_order: number;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_steps: number;
  target_steps_min: number;
  target_water_ml: number;
}

/** Keeps Postgres column naming out of every component. */
export const mapMember = (row: MemberRow): Member => ({
  id: row.id,
  name: row.name,
  accent: resolveAccent(row.accent, row.sort_order),
  sortOrder: row.sort_order,
  targets: {
    calories: row.target_calories,
    protein: row.target_protein,
    carbs: row.target_carbs,
    fat: row.target_fat,
    steps: row.target_steps,
    stepsMin: row.target_steps_min,
    waterMl: row.target_water_ml,
  },
});

export const getMembers = async (): Promise<Member[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[members] read failed:', error.message);
    return [];
  }

  return (data as MemberRow[]).map(mapMember);
};
