import { Landing } from '@components/Landing/Landing';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { PersonalModeNotice } from '@components/PersonalModeNotice/PersonalModeNotice';
import { SessionForm } from '@components/SessionForm/SessionForm';
import { SessionList } from '@components/SessionList/SessionList';
import { SessionsReadMarker } from '@components/SessionsReadMarker/SessionsReadMarker';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getScopedMembers } from '@/lib/data/members';
import { getUpcomingSessions, upcomingSessions } from '@/lib/data/sessions';
import { readViewerContext } from '@/lib/data/viewerScope';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import ui from '@/styles/ui.module.css';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Sessions — FitnessJourni',
  description: 'Book a run, workout, swim or walk together',
};

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
  const { viewer, activeGroup, scope } = await readViewerContext();

  // Sessions belong to a group, so Personal mode has none to show or book.
  if (!activeGroup) {
    return (
      <PageLayout>
        <PageHeader eyebrow="Sessions" title="What's coming up" />
        <PersonalModeNotice
          title="Sessions are a group thing"
          description="Booking a run or a workout together needs people to book it with. Join a group or create one, and sessions appear here."
        />
      </PageLayout>
    );
  }

  const [members, sessions] = await Promise.all([
    getScopedMembers(scope),
    getUpcomingSessions(today, activeGroup.id),
  ]);
  const orderedMembers = viewerFirst(members, viewer.memberId);
  const visibleSessions = upcomingSessions(sessions, today, now.getHours() * 60 + now.getMinutes());

  return (
    <PageLayout>
      <SessionsReadMarker key={`${viewer.memberId}:${activeGroup.id}`} />
      <PageHeader eyebrow="Sessions" title="What's coming up" />

      <SessionList
        sessions={visibleSessions}
        members={orderedMembers}
        viewerId={viewer.memberId}
        initialNow={now.getTime()}
      />

      <section className={styles.booking}>
        <h2 className={ui.sectionTitle}>Book one</h2>
        <SessionForm members={orderedMembers} viewerId={viewer.memberId} />
      </section>
    </PageLayout>
  );
};

export default SessionsPage;
