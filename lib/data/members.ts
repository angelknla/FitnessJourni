import { defaultTargets, resolveAccent } from '@data/fitnessData';
import { getSupabase } from '@/lib/supabase/server';
import type { Member } from '@/types/fitness';

export interface MemberRow {
  id: string;
  name: string;
  accent: string;
  avatar_path: string | null;
  sort_order: number;
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  target_steps: number | null;
  target_steps_min: number | null;
  target_water_ml: number | null;
  target_workouts_per_week: number | null;
}

/** Keeps Postgres column naming out of every component. */
export const mapMember = (row: MemberRow): Member => ({
  id: row.id,
  name: row.name,
  accent: resolveAccent(row.accent, row.sort_order),
  avatarPath: row.avatar_path ?? null,
  sortOrder: row.sort_order,
  /*
   * Each target falls back to the playbook default. A column added later but not
   * yet migrated would otherwise arrive as undefined and render as "of 0" or,
   * worse, blank — which is how target_workouts_per_week first showed up.
   */
  targets: {
    calories: row.target_calories ?? defaultTargets.calories,
    protein: row.target_protein ?? defaultTargets.protein,
    carbs: row.target_carbs ?? defaultTargets.carbs,
    fat: row.target_fat ?? defaultTargets.fat,
    steps: row.target_steps ?? defaultTargets.steps,
    stepsMin: row.target_steps_min ?? defaultTargets.stepsMin,
    waterMl: row.target_water_ml ?? defaultTargets.waterMl,
    workoutsPerWeek: row.target_workouts_per_week ?? defaultTargets.workoutsPerWeek,
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
