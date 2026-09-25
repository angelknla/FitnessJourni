import { Landing } from '@components/Landing/Landing';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { Today } from '@components/Today/Today';
import { earlier, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getLogsForDate } from '@/lib/data/logs';
import { getMembers } from '@/lib/data/members';
import { getWorkoutsSince, tallyWorkouts } from '@/lib/data/workouts';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Today — FitnessJourni',
  description: 'Steps, water, calories and macros for everyone, today',
};

/** Always render fresh: the whole point is seeing what the others just logged. */
export const dynamic = 'force-dynamic';

const Homepage = async () => {
  // Before any fetch: a locked visitor must not cause member data to be loaded,
  // because it would be serialised into the RSC payload even if never displayed.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  // Resolved on the server because the data fetch is keyed by it. Set TZ in the
  // host environment if the deployed date ever disagrees with yours.
  const now = new Date();
  const date = toISODate(now);
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  const [members, logs, workouts] = await Promise.all([
    getMembers(),
    getLogsForDate(date),
    getWorkoutsSince(earlier(startOfWeek(date), startOfMonth(date))),
  ]);

  return (
    <Today
      members={members}
      logs={logs}
      workouts={workouts}
      tallies={tallyWorkouts(workouts, date)}
      date={date}
      dateLabel={dateLabel}
    />
  );
};

export default Homepage;
