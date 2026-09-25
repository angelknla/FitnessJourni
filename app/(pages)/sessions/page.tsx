import { ArrowLeftIcon } from '@components/Icons/Icons';
import { Landing } from '@components/Landing/Landing';
import { SessionForm } from '@components/SessionForm/SessionForm';
import { SessionList } from '@components/SessionList/SessionList';
import { SessionsReadMarker } from '@components/SessionsReadMarker/SessionsReadMarker';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { toISODate } from '@utils/date';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getMembers } from '@/lib/data/members';
import { getUpcomingSessions } from '@/lib/data/sessions';
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

  const today = toISODate(new Date());
  const [members, sessions, viewer] = await Promise.all([
    getMembers(),
    getUpcomingSessions(today),
    readViewer(),
  ]);
  const orderedMembers = viewerFirst(members, viewer.memberId);

  return (
    <div className={styles.page}>
      <SessionsReadMarker />
      <Link href="/" className={styles.back}>
        <ArrowLeftIcon />
        Home
      </Link>

      <header className={styles.head}>
        <p className={styles.eyebrow}>Sessions</p>
        <h1 className={styles.title}>What's coming up</h1>
      </header>

      <SessionList sessions={sessions} members={orderedMembers} viewerId={viewer.memberId} />

      <section className={styles.booking}>
        <h2 className={styles.sectionHeading}>Book one</h2>
        <SessionForm members={orderedMembers} viewerId={viewer.memberId} />
      </section>
    </div>
  );
};

export default SessionsPage;
