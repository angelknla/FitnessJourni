import { defaultTargets, resolveAccent } from '@data/fitnessData';
import { cache } from 'react';
import { getGroupMemberIds } from '@/lib/data/groups';
import type { DataScope } from '@/lib/data/scope';
import { getSupabase } from '@/lib/supabase/server';
import type { Member } from '@/types/fitness';

export interface MemberRow {
  id: string;
  name: string;
  surname?: string | null;
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
  target_sleep_hours?: number | null;
  target_workouts_per_week: number | null;
}

/** Keeps Postgres column naming out of every component. */
export const mapMember = (row: MemberRow): Member => ({
  id: row.id,
  firstName: row.name,
  surname: row.surname?.trim() || null,
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
    sleepHours: row.target_sleep_hours ?? defaultTargets.sleepHours,
    workoutsPerWeek: row.target_workouts_per_week ?? defaultTargets.workoutsPerWeek,
  },
});

export const getMembers = cache(async (): Promise<Member[]> => {
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
});

/**
 * The people a group-scoped page should show: the active group's accepted
 * members, or just the viewer in Personal mode.
 *
 * Kept separate from getMembers(), which still returns everyone — account
 * enrollment and the globally unique accent colours are not group concerns, and
 * narrowing those would break them.
 */
export const getScopedMembers = async (scope: DataScope): Promise<Member[]> => {
  const everyone = await getMembers();

  if (scope.groupId) {
    const ids = new Set(await getGroupMemberIds(scope.groupId));
    return everyone.filter((member) => ids.has(member.id));
  }

  return scope.memberId ? everyone.filter((member) => member.id === scope.memberId) : [];
};
