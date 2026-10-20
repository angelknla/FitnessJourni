import { Landing } from '@components/Landing/Landing';
import { LogsPeriodNav } from '@components/LogsPeriodNav/LogsPeriodNav';
import { LogsTable } from '@components/LogsTable/LogsTable';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { fromISODate, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { awardMedals, type Period, summarise } from '@/lib/aggregate';
import { getLogsSince } from '@/lib/data/logs';
import { getScopedMembers } from '@/lib/data/members';
import { readViewerContext } from '@/lib/data/viewerScope';
import { countWorkouts, getWorkoutsSince } from '@/lib/data/workouts';
import { readLocalTime } from '@/lib/localTime';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Logs — FitnessJourni',
  description: 'Compare steps, water, nutrition and sleep across the group',
};

interface LogsPageProps {
  searchParams: Promise<{ period?: string; date?: string }>;
}

const LogsPage = async ({ searchParams }: LogsPageProps) => {
  // Gate before fetching — see the note in app/layout.tsx.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { period: rawPeriod, date: rawDate } = await searchParams;
  const { today } = await readLocalTime();
  const selectedDate =
    rawDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    toISODate(fromISODate(rawDate)) === rawDate &&
    rawDate <= today
      ? rawDate
      : null;
  const period: Period = rawPeriod === 'today' || rawPeriod === 'month' ? rawPeriod : 'week';
  const from =
    selectedDate ??
    (period === 'today' ? today : period === 'week' ? startOfWeek(today) : startOfMonth(today));
  const through = selectedDate ?? today;

  const { viewer, scope } = await readViewerContext();
  const [members, logs, workouts] = await Promise.all([
    getScopedMembers(scope),
    getLogsSince(from, scope),
    getWorkoutsSince(from, scope),
  ]);

  const summaries = summarise(logs, from, through);
  const workoutCounts = countWorkouts(workouts, from, through);
  const targetsByMember = Object.fromEntries(members.map((member) => [member.id, member.targets]));

  return (
    <PageLayout>
      <PageHeader eyebrow="Logs" title="How everyone is doing" />

      <LogsPeriodNav period={period} selectedDate={selectedDate} today={today} />

      <LogsTable
        members={viewerFirst(members, viewer.memberId)}
        summaries={summaries}
        workoutCounts={workoutCounts}
        medals={awardMedals(summaries, workoutCounts, targetsByMember)}
        showAverages={!selectedDate && period !== 'today'}
      />

      <p className={styles.note}>
        Medals show each column&apos;s gold, silver and bronze places. Nutrition compares each
        person&apos;s calorie and protein averages with their own targets.
      </p>
    </PageLayout>
  );
};

export default LogsPage;
