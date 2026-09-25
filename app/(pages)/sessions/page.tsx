import { ArrowLeftIcon } from '@components/Icons/Icons';
import { Landing } from '@components/Landing/Landing';
import { SessionForm } from '@components/SessionForm/SessionForm';
import { SessionList } from '@components/SessionList/SessionList';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { toISODate } from '@utils/date';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getMembers } from '@/lib/data/members';
import { getUpcomingSessions } from '@/lib/data/sessions';
import { isUnlocked } from '@/lib/session';
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
  const [members, sessions] = await Promise.all([getMembers(), getUpcomingSessions(today)]);

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        <ArrowLeftIcon />
        Today
      </Link>

      <header className={styles.head}>
        <p className={styles.eyebrow}>Sessions</p>
        <h1 className={styles.title}>What's coming up</h1>
      </header>

      <SessionList sessions={sessions} members={members} />

      <section className={styles.booking}>
        <h2 className={styles.sectionHeading}>Book one</h2>
        <SessionForm members={members} />
      </section>
    </div>
  );
};

export default SessionsPage;
