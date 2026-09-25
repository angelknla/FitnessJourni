import { Footer } from '@components/Footer/Footer';
import { Header } from '@components/Header/Header';
import { SessionBanner } from '@components/SessionBanner/SessionBanner';
import { toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { getMembers } from '@/lib/data/members';
import { getUpcomingSessions, nextSession } from '@/lib/data/sessions';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer, type Viewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import type { Member } from '@/types/fitness';
import type { LayoutProps } from '@/types/LayoutProps';

import '@/styles/globals.css';
import styles from './page.module.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FitnessJourni',
  description: 'Shared daily tracking and training sessions',
  icons: {
    icon: '/icon.svg',
  },
};

const bannerDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric' });

/** A locked visitor is nobody; the cookie is not even read until past the gate. */
const LOCKED_VIEWER: Viewer = { memberId: null, chosen: false };

/** The soonest session that has not happened yet, formatted for the banner. */
const nextSessionBanner = async (members: Member[]) => {
  const now = new Date();
  const today = toISODate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sessions = await getUpcomingSessions(today);
  const session = nextSession(sessions, today, nowMinutes);

  if (!session) {
    return null;
  }

  const bookedBy = session.createdBy
    ? members.find((member) => member.id === session.createdBy)?.name
    : undefined;

  const dayLabel =
    session.date === today ? 'Today' : bannerDay.format(new Date(`${session.date}T12:00:00`));

  return { session, bookedBy, whenLabel: `${dayLabel} at ${session.time}` };
};

const RootLayout = async ({ children }: LayoutProps) => {
  /*
   * Only used to swap the nav for a Log in button. The gate itself lives in each
   * page, NOT here: Next renders the page concurrently with the layout, so a
   * layout that declines to render `children` does not stop the page executing —
   * its fetched data still lands in the RSC payload for anyone to read.
   */
  const locked = !(await isUnlocked());
  const configured = isSupabaseConfigured();

  /*
   * Only fetched once past the gate. A locked visitor must not cause this query
   * to run, because the result would be serialised into the RSC payload whether
   * or not anything renders — which is also why the identity picker asks who you
   * are only after the passcode, never alongside it.
   *
   * Fetched here rather than inside the banner because the header needs the same
   * list for the picker, and one query serves both.
   */
  const members: Member[] = locked || !configured ? [] : await getMembers();
  const viewer: Viewer = locked ? LOCKED_VIEWER : await readViewer();
  const banner = locked || !configured ? null : await nextSessionBanner(members);

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <div className={styles.appWrapper}>
          <Header
            locked={locked}
            members={viewerFirst(members, viewer.memberId)}
            viewer={viewer}
          />

          {banner && (
            <SessionBanner
              session={banner.session}
              bookedBy={banner.bookedBy}
              whenLabel={banner.whenLabel}
            />
          )}
          <main className={styles.content}>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
