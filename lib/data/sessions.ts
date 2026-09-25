import { toShortTime } from '@utils/date';
import { getSupabase } from '@/lib/supabase/server';
import type { ActivityType, TrainingSession } from '@/types/fitness';

export interface SessionRow {
  id: string;
  session_date: string;
  session_time: string;
  activity: string;
  note: string | null;
  created_by: string | null;
}

export const mapSession = (row: SessionRow): TrainingSession => ({
  id: row.id,
  date: row.session_date,
  // Postgres hands back HH:MM:SS; the UI only ever wants HH:MM.
  time: toShortTime(row.session_time),
  activity: row.activity as ActivityType,
  note: row.note,
  createdBy: row.created_by,
});

/** Sessions from `fromDate` onwards, soonest first. */
export const getUpcomingSessions = async (fromDate: string): Promise<TrainingSession[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gte('session_date', fromDate)
    .order('session_date', { ascending: true })
    .order('session_time', { ascending: true });

  if (error) {
    console.error('[sessions] read failed:', error.message);
    return [];
  }

  return (data as SessionRow[]).map(mapSession);
};
