import { getSupabase } from '@/lib/supabase/server';
import type { DailyLog } from '@/types/fitness';

export interface DailyLogRow {
  member_id: string;
  log_date: string;
  steps: number;
  water_ml: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const mapLog = (row: DailyLogRow): DailyLog => ({
  memberId: row.member_id,
  date: row.log_date,
  steps: row.steps,
  waterMl: row.water_ml,
  calories: row.calories,
  proteinG: row.protein_g,
  carbsG: row.carbs_g,
  fatG: row.fat_g,
});

/** An untouched day is a real state, not missing data — render it as zeroes. */
export const emptyLog = (memberId: string, date: string): DailyLog => ({
  memberId,
  date,
  steps: 0,
  waterMl: 0,
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
});

/** Every member's log for one day, keyed by member id for O(1) lookup. */
export const getLogsForDate = async (date: string): Promise<Record<string, DailyLog>> => {
  const supabase = getSupabase();
  if (!supabase) {
    return {};
  }

  const { data, error } = await supabase.from('daily_logs').select('*').eq('log_date', date);

  if (error) {
    console.error('[logs] read failed:', error.message);
    return {};
  }

  const byMember: Record<string, DailyLog> = {};
  for (const row of data as DailyLogRow[]) {
    const log = mapLog(row);
    byMember[log.memberId] = log;
  }

  return byMember;
};

/** Every member's logs from `fromDate` onwards, for the comparison view. */
export const getLogsSince = async (fromDate: string): Promise<DailyLog[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .gte('log_date', fromDate)
    .order('log_date', { ascending: false });

  if (error) {
    console.error('[logs] range read failed:', error.message);
    return [];
  }

  return (data as DailyLogRow[]).map(mapLog);
};
