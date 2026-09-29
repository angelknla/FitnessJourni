import { getGroupMemberIds } from '@/lib/data/groups';
import { type DataScope, isEmptyScope } from '@/lib/data/scope';
import { getSupabase } from '@/lib/supabase/server';
import type { DailyLog } from '@/types/fitness';

export interface DailyLogRow {
  id?: string;
  member_id: string;
  log_date: string;
  steps: number;
  water_ml: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sleep_hours?: number | null;
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
  sleepHours: row.sleep_hours == null ? null : Number(row.sleep_hours),
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
  sleepHours: null,
});

/*
 * A log is visible to a group when EITHER of these holds:
 *
 *   * its author is a member of that group right now — the point of the app is
 *     that your group sees your numbers, so joining shows them your history too;
 *   * or it carries an association row from when it was created, which is what
 *     keeps a former member's days visible after they leave rather than rewriting
 *     past comparisons the moment somebody goes.
 *
 * Plus the viewer's own, always.
 *
 * Three reads merged in JS rather than one query: PostgREST cannot express that
 * OR across an embedded resource, and hiding the rule in a database view would put
 * it somewhere the tests cannot reach.
 */
const sharedWithGroup = '*, group_daily_logs!inner(group_id)';

const collect = (
  results: { data: unknown; error: { message: string } | null }[],
  label: string
): DailyLogRow[] => {
  const rows: DailyLogRow[] = [];

  for (const result of results) {
    if (result.error) {
      console.error(`[logs] ${label} failed:`, result.error.message);
      continue;
    }
    rows.push(...((result.data ?? []) as DailyLogRow[]));
  }

  return rows;
};

/** Every visible log for one day, keyed by member id for O(1) lookup. */
export const getLogsForDate = async (
  date: string,
  scope: DataScope
): Promise<Record<string, DailyLog>> => {
  const supabase = getSupabase();
  if (!supabase || isEmptyScope(scope)) {
    return {};
  }

  const memberIds = scope.groupId ? await getGroupMemberIds(scope.groupId) : [];

  const results = await Promise.all([
    ...(scope.groupId
      ? [
          supabase
            .from('daily_logs')
            .select(sharedWithGroup)
            .eq('group_daily_logs.group_id', scope.groupId)
            .eq('log_date', date),
        ]
      : []),
    ...(memberIds.length > 0
      ? [supabase.from('daily_logs').select('*').in('member_id', memberIds).eq('log_date', date)]
      : []),
    ...(scope.memberId
      ? [
          supabase
            .from('daily_logs')
            .select('*')
            .eq('member_id', scope.memberId)
            .eq('log_date', date),
        ]
      : []),
  ]);

  // One row per member per day, so keying by member is also the de-duplication.
  const byMember: Record<string, DailyLog> = {};
  for (const row of collect(results, 'read')) {
    const log = mapLog(row);
    byMember[log.memberId] = log;
  }

  return byMember;
};

/** Every visible log from `fromDate` onwards, for the comparison views. */
export const getLogsSince = async (fromDate: string, scope: DataScope): Promise<DailyLog[]> => {
  const supabase = getSupabase();
  if (!supabase || isEmptyScope(scope)) {
    return [];
  }

  const memberIds = scope.groupId ? await getGroupMemberIds(scope.groupId) : [];

  const results = await Promise.all([
    ...(scope.groupId
      ? [
          supabase
            .from('daily_logs')
            .select(sharedWithGroup)
            .eq('group_daily_logs.group_id', scope.groupId)
            .gte('log_date', fromDate),
        ]
      : []),
    ...(memberIds.length > 0
      ? [
          supabase
            .from('daily_logs')
            .select('*')
            .in('member_id', memberIds)
            .gte('log_date', fromDate),
        ]
      : []),
    ...(scope.memberId
      ? [
          supabase
            .from('daily_logs')
            .select('*')
            .eq('member_id', scope.memberId)
            .gte('log_date', fromDate),
        ]
      : []),
  ]);

  const seen = new Set<string>();
  const logs: DailyLog[] = [];

  for (const row of collect(results, 'range read')) {
    const key = `${row.member_id}|${row.log_date}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    logs.push(mapLog(row));
  }

  return logs.sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * The viewer's own log, whatever it happens to be shared with. Quick entry edits
 * this row directly, so it must not be filtered by the group being viewed — a day
 * logged before joining is still theirs to correct.
 */
export const getOwnLog = async (memberId: string, date: string): Promise<DailyLog | null> => {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('member_id', memberId)
    .eq('log_date', date)
    .maybeSingle();

  if (error) {
    console.error('[logs] own read failed:', error.message);
    return null;
  }

  return data ? mapLog(data as DailyLogRow) : null;
};
