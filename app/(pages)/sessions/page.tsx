import { Landing } from '@components/Landing/Landing';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SessionForm } from '@components/SessionForm/SessionForm';
import { SessionList } from '@components/SessionList/SessionList';
import { SessionsReadMarker } from '@components/SessionsReadMarker/SessionsReadMarker';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getMembers } from '@/lib/data/members';
import { getUpcomingSessions, upcomingSessions } from '@/lib/data/sessions';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Sessions — FitnessJourni',
  description: 'Book a run, workout, swim or walk together',
};

export const dynamic = 'force-dynamic';

const SessionsPage = async () => {
  // Gate before fetching — see the note in app/layout.tsx.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const now = new Date();
  const today = toISODate(now);
  const [members, sessions, viewer] = await Promise.all([
    getMembers(),
    getUpcomingSessions(today),
    readViewer(),
  ]);
  const orderedMembers = viewerFirst(members, viewer.memberId);
  const visibleSessions = upcomingSessions(
    sessions,
    today,
    now.getHours() * 60 + now.getMinutes()
  );

  return (
    <PageLayout>
      <SessionsReadMarker />
      <PageHeader animatedBack eyebrow="Sessions" title="What's coming up" />

      <SessionList
        sessions={visibleSessions}
        members={orderedMembers}
        viewerId={viewer.memberId}
        initialNow={now.getTime()}
      />

      <section className={styles.booking}>
        <h2 className={styles.sectionHeading}>Book one</h2>
        <SessionForm members={orderedMembers} viewerId={viewer.memberId} />
      </section>
    </PageLayout>
  );
};

export default SessionsPage;
