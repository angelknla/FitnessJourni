import { minutesOfTime, toShortTime } from '@utils/date';
import { getSupabase } from '@/lib/supabase/server';
import type { ActivityType, RsvpStatus, TrainingSession } from '@/types/fitness';

export interface SessionRow {
  id: string;
  session_date: string;
  session_time: string;
  activity: string;
  note: string | null;
  created_by: string | null;
  session_rsvps?: { member_id: string; status: string }[];
}

export const mapSession = (row: SessionRow): TrainingSession => ({
  id: row.id,
  date: row.session_date,
  // Postgres hands back HH:MM:SS; the UI only ever wants HH:MM.
  time: toShortTime(row.session_time),
  activity: row.activity as ActivityType,
  note: row.note,
  createdBy: row.created_by,
  rsvps: (row.session_rsvps ?? []).map((rsvp) => ({
    memberId: rsvp.member_id,
    status: rsvp.status as RsvpStatus,
  })),
});

/** Sessions from `fromDate` onwards, soonest first. */
export const getUpcomingSessions = async (fromDate: string): Promise<TrainingSession[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*, session_rsvps(member_id, status)')
    .gte('session_date', fromDate)
    .order('session_date', { ascending: true })
    .order('session_time', { ascending: true });

  if (error) {
    console.error('[sessions] read failed:', error.message);
    return [];
  }

  return (data as SessionRow[]).map(mapSession);
};

/**
 * The soonest session that has not already happened. getUpcomingSessions filters
 * by date only, so a 07:00 run is still "upcoming" at 18:00 — the time has to be
 * compared too, or the banner advertises a session people already missed.
 */
export const nextSession = (
  sessions: TrainingSession[],
  today: string,
  nowMinutes: number
): TrainingSession | null => {
  const ahead = sessions.filter((session) => {
    if (session.date > today) {
      return true;
    }
    if (session.date < today) {
      return false;
    }
    return minutesOfTime(session.time) >= nowMinutes;
  });

  // The query already orders by date then time, and filtering preserves that.
  return ahead[0] ?? null;
};
