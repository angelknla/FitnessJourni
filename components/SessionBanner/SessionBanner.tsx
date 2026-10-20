'use client';

import { CrossIcon } from '@components/Icons/Icons';
import Link from '@components/NavigationLink/NavigationLink';
import { activityLabels } from '@data/fitnessData';
import { useEffect, useState } from 'react';
import ui from '@/styles/ui.module.css';
import type { TrainingSession } from '@/types/fitness';

import styles from './SessionBanner.module.css';

interface SessionBannerProps {
  session: TrainingSession;
  /** Name of whoever booked it, if anyone claimed it. */
  bookedBy?: string;
  /** Pre-formatted on the server, so the banner needs no clock of its own. */
  whenLabel: string;
  expiresAt: number;
}

const STORAGE_KEY = 'fj_dismissed_session';

export const SessionBanner = ({ session, bookedBy, whenLabel, expiresAt }: SessionBannerProps) => {
  /*
   * Starts hidden and appears after mount once storage has been read. Rendering
   * it first and hiding it would flash the banner at someone who dismissed it.
   */
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissedId: string | null = null;

    // Storage throws in some private-browsing modes, so never assume it works.
    try {
      dismissedId = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      dismissedId = null;
    }

    const remaining = expiresAt - Date.now();
    setVisible(dismissedId !== session.id && remaining > 0);

    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timeout);
  }, [expiresAt, session.id]);

  const dismiss = () => {
    setVisible(false);
    try {
      // Keyed by id, so dismissing this one does not silence the next session.
      window.localStorage.setItem(STORAGE_KEY, session.id);
    } catch {
      // Dismissal just will not persist; the banner is not worth failing over.
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <aside className={`${styles.banner} ${ui.card}`} aria-label="Next session">
      <div className={styles.body}>
        <p className={styles.eyebrow}>Next session</p>
        <p className={styles.headline}>
          {activityLabels[session.activity]} · {whenLabel}
        </p>
        {session.note && <p className={styles.note}>{session.note}</p>}
        {bookedBy && <p className={styles.by}>Booked by {bookedBy}</p>}
        <Link href="/sessions" className={styles.link}>
          See all sessions
        </Link>
      </div>

      <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss">
        <CrossIcon size={13} />
      </button>
    </aside>
  );
};
