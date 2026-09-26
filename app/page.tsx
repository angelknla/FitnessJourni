import { Home } from '@components/Home/Home';
import { Landing } from '@components/Landing/Landing';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { earlier, fromISODate, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getLogsForDate } from '@/lib/data/logs';
import { getMembers } from '@/lib/data/members';
import { getWorkoutsSince, tallyWorkouts } from '@/lib/data/workouts';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Home — FitnessJourni',
  description: 'Shared daily steps, water, nutrition, workouts and sleep',
};

/** Always render fresh: the whole point is seeing what the others just logged. */
export const dynamic = 'force-dynamic';

interface HomepageProps {
  searchParams: Promise<{ date?: string }>;
}

const resolveHomeDate = (requestedDate?: string) => {
  const today = toISODate(new Date());
  const date =
    requestedDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
      toISODate(fromISODate(requestedDate)) === requestedDate &&
      requestedDate <= today
      ? requestedDate
      : today;
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromISODate(date));

  return { date, dateLabel, today };
};

const Homepage = async ({ searchParams }: HomepageProps) => {
  // Before any fetch: a locked visitor must not cause member data to be loaded,
  // because it would be serialised into the RSC payload even if never displayed.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { date: requestedDate } = await searchParams;
  // Resolved on the server because both metadata and data fetching are keyed by it.
  // Set TZ in the host environment if the deployed date ever disagrees with yours.
  const { date, dateLabel, today } = resolveHomeDate(requestedDate);
  const yesterday = fromISODate(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const datePickerLabel =
    date === today
      ? 'Today'
      : date === toISODate(yesterday)
        ? 'Yesterday'
        : new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        }).format(fromISODate(date));

  const [members, logs, workouts, viewer] = await Promise.all([
    getMembers(),
    getLogsForDate(date),
    getWorkoutsSince(earlier(startOfWeek(date), startOfMonth(date))),
    readViewer(),
  ]);

  return (
    <Home
      members={viewerFirst(members, viewer.memberId)}
      logs={logs}
      workouts={workouts}
      tallies={tallyWorkouts(workouts, date)}
      date={date}
      today={today}
      datePickerLabel={datePickerLabel}
      dateLabel={dateLabel}
      viewerId={viewer.memberId}
    />
  );
};

export default Homepage;
