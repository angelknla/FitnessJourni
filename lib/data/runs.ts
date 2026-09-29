import { startOfMonth, startOfWeek } from '@utils/date';
import { type DataScope, isEmptyScope } from '@/lib/data/scope';
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

/*
 * A run is visible when it was shared with the active group at the time it was
 * logged, or when the viewer logged it. Attendance does not grant visibility on
 * its own: the run belongs to the groups its author was in, which is what keeps a
 * run out of a group the author has since joined.
 */
const sharedWithGroup = '*, run_attendees(member_id), group_runs!inner(group_id)';

const collectRuns = (
  results: { data: unknown; error: { message: string } | null }[],
  label: string
): GroupRun[] => {
  const byId = new Map<string, GroupRun>();

  for (const result of results) {
    if (result.error) {
      console.error(`[runs] ${label} failed:`, result.error.message);
      continue;
    }
    for (const row of (result.data ?? []) as RunRow[]) {
      byId.set(row.id, mapRun(row));
    }
  }

  // Newest first, and stable for two runs on the same day.
  return [...byId.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  );
};

export const getRunsSince = async (fromDate: string, scope: DataScope): Promise<GroupRun[]> => {
  const supabase = getSupabase();
  if (!supabase || isEmptyScope(scope)) {
    return [];
  }

  const results = await Promise.all([
    ...(scope.groupId
      ? [
          supabase
            .from('runs')
            .select(sharedWithGroup)
            .eq('group_runs.group_id', scope.groupId)
            .gte('run_date', fromDate),
        ]
      : []),
    ...(scope.memberId
      ? [
          supabase
            .from('runs')
            .select('*, run_attendees(member_id)')
            .eq('created_by', scope.memberId)
            .gte('run_date', fromDate),
        ]
      : []),
  ]);

  return collectRuns(results, 'read');
};

export const getLatestRuns = async (scope: DataScope, limit = 3): Promise<GroupRun[]> => {
  const supabase = getSupabase();
  if (!supabase || isEmptyScope(scope)) {
    return [];
  }

  /*
   * Each read takes `limit` and the slice happens after merging: the newest three
   * of the union are not necessarily the newest three of either half.
   */
  const results = await Promise.all([
    ...(scope.groupId
      ? [
          supabase
            .from('runs')
            .select(sharedWithGroup)
            .eq('group_runs.group_id', scope.groupId)
            .order('run_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit),
        ]
      : []),
    ...(scope.memberId
      ? [
          supabase
            .from('runs')
            .select('*, run_attendees(member_id)')
            .eq('created_by', scope.memberId)
            .order('run_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit),
        ]
      : []),
  ]);

  return collectRuns(results, 'latest read').slice(0, limit);
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
