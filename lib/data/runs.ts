import { startOfMonth, startOfWeek } from '@utils/date';
import { getSupabase } from '@/lib/supabase/server';
import type { GroupRun, RunTally } from '@/types/fitness';

export interface RunRow {
  id: string;
  run_date: string;
  duration_minutes: number | string;
  distance_km: number | string;
  pace_seconds_per_km: number | null;
  created_by: string | null;
  run_attendees?: { member_id: string }[];
}

export const mapRun = (row: RunRow): GroupRun => ({
  id: row.id,
  date: row.run_date,
  durationMinutes: Number(row.duration_minutes),
  distanceKm: Number(row.distance_km),
  paceSecondsPerKm: row.pace_seconds_per_km,
  createdBy: row.created_by,
  attendeeIds: (row.run_attendees ?? []).map((attendee) => attendee.member_id),
});

export const getRunsSince = async (fromDate: string): Promise<GroupRun[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('runs')
    .select('*, run_attendees(member_id)')
    .gte('run_date', fromDate)
    .order('run_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[runs] read failed:', error.message);
    return [];
  }

  return (data as RunRow[]).map(mapRun);
};

export const getLatestRuns = async (limit = 3): Promise<GroupRun[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('runs')
    .select('*, run_attendees(member_id)')
    .order('run_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[runs] latest read failed:', error.message);
    return [];
  }

  return (data as RunRow[]).map(mapRun);
};

export const tallyRuns = (runs: GroupRun[], today: string): Record<string, RunTally> => {
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);
  const tallies: Record<string, RunTally> = {};

  for (const run of runs) {
    if (run.date > today) {
      continue;
    }

    for (const memberId of new Set(run.attendeeIds)) {
      const tally = tallies[memberId] ?? { week: 0, month: 0 };
      if (run.date >= weekStart) {
        tally.week += 1;
      }
      if (run.date >= monthStart) {
        tally.month += 1;
      }
      tallies[memberId] = tally;
    }
  }

  return tallies;
};

export const formatRunDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round((minutes % 60) * 10) / 10;
  const remainderText = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(
    remainder
  );
  return hours > 0
    ? `${hours}h ${remainder < 10 ? '0' : ''}${remainderText}m`
    : `${remainderText}m`;
};

export const formatRunPace = (
  durationMinutes: number,
  distanceKm: number,
  manualPaceSeconds?: number | null
): string => {
  if ((!manualPaceSeconds || manualPaceSeconds <= 0) && (durationMinutes <= 0 || distanceKm <= 0)) {
    return '—';
  }

  const totalSeconds = manualPaceSeconds || Math.round((durationMinutes * 60) / distanceKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
};
