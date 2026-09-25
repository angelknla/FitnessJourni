import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { Today } from '@components/Today/Today';
import { toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getLogsForDate } from '@/lib/data/logs';
import { getMembers } from '@/lib/data/members';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Today — FitnessJourni',
  description: 'Steps, water, calories and macros for everyone, today',
};

/** Always render fresh: the whole point is seeing what the others just logged. */
export const dynamic = 'force-dynamic';

const Homepage = async () => {
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

  const [members, logs] = await Promise.all([getMembers(), getLogsForDate(date)]);

  return <Today members={members} logs={logs} date={date} dateLabel={dateLabel} />;
};

export default Homepage;
