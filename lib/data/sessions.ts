import { minutesOfTime, toShortTime } from '@utils/date';
import { cache } from 'react';
import { getSupabase } from '@/lib/supabase/server';
import type { ActivityType, RsvpStatus, TrainingSession } from '@/types/fitness';

export const SESSION_GRACE_MINUTES = 45;

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

export const hasUnreadSessions = (
  latestSessionAt: string | null,
  lastReadAt: string | null
): boolean => Boolean(latestSessionAt && (!lastReadAt || latestSessionAt > lastReadAt));

export const getHasUnreadSessions = async (memberId: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  const [latestResult, readResult] = await Promise.all([
    supabase
      .from('sessions')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('session_reads').select('last_read_at').eq('member_id', memberId).maybeSingle(),
  ]);

  if (latestResult.error || readResult.error) {
    console.error(
      '[sessions] unread check failed:',
      latestResult.error?.message ?? readResult.error?.message
    );
    return false;
  }

  const latestSessionAt = latestResult.data?.[0]?.created_at as string | undefined;
  const lastReadAt = readResult.data?.last_read_at as string | undefined;
  return hasUnreadSessions(latestSessionAt ?? null, lastReadAt ?? null);
};

/** Sessions from `fromDate` onwards, soonest first. */
export const getUpcomingSessions = cache(async (fromDate: string): Promise<TrainingSession[]> => {
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
});

/** Keep a session visible until 45 minutes after its booked start time. */
export const upcomingSessions = (
  sessions: TrainingSession[],
  today: string,
  nowMinutes: number
): TrainingSession[] =>
  sessions.filter((session) => {
    if (session.date > today) {
      return true;
    }
    if (session.date < today) {
      return false;
    }
    return minutesOfTime(session.time) + SESSION_GRACE_MINUTES > nowMinutes;
  });

/** The query is already ordered, so the first session inside the grace window is next. */
export const nextSession = (
  sessions: TrainingSession[],
  today: string,
  nowMinutes: number
): TrainingSession | null => {
  const ahead = upcomingSessions(sessions, today, nowMinutes);

  // The query already orders by date then time, and filtering preserves that.
  return ahead[0] ?? null;
};
