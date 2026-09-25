'use client';

import { activityLabels } from '@data/fitnessData';
import { fromISODate } from '@utils/date';
import { useActionState } from 'react';
import { type ActionState, deleteSession } from '@/app/actions';
import type { Member, TrainingSession } from '@/types/fitness';

import styles from './SessionList.module.css';

interface SessionListProps {
  sessions: TrainingSession[];
  members: Member[];
}

const initial: ActionState = { ok: true };

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Own component so each row gets its own action state without hooks in a loop. */
const SessionRow = ({ session, bookedBy }: { session: TrainingSession; bookedBy?: string }) => {
  const [state, formAction, isPending] = useActionState(deleteSession, initial);

  return (
    <li className={styles.row}>
      <span className={styles.time}>{session.time}</span>

      <span className={styles.details}>
        <span className={styles.activity}>{activityLabels[session.activity]}</span>
        {session.note && <span className={styles.note}>{session.note}</span>}
        {bookedBy && <span className={styles.by}>Booked by {bookedBy}</span>}
        {state.error && (
          <span className={styles.error} role="alert">
            {state.error}
          </span>
        )}
      </span>

      <form action={formAction}>
        <input type="hidden" name="id" value={session.id} />
        <button
          type="submit"
          className={styles.remove}
          disabled={isPending}
          aria-label={`Remove ${activityLabels[session.activity]} at ${session.time}`}
        >
          {isPending ? '…' : '×'}
        </button>
      </form>
    </li>
  );
};

export const SessionList = ({ sessions, members }: SessionListProps) => {
  if (sessions.length === 0) {
    return <p className={styles.empty}>Nothing booked yet. Pick a day below and get one in.</p>;
  }

  const nameFor = (id: string | null) =>
    id ? members.find((member) => member.id === id)?.name : undefined;

  // Already ordered by the query; a Map keeps that order while grouping.
  const days = new Map<string, TrainingSession[]>();
  for (const session of sessions) {
    const existing = days.get(session.date);
    if (existing) {
      existing.push(session);
    } else {
      days.set(session.date, [session]);
    }
  }

  return (
    <div className={styles.list}>
      {[...days].map(([date, daySessions]) => (
        <section className={styles.day} key={date}>
          <h3 className={styles.dayHeading}>{dayFormat.format(fromISODate(date))}</h3>
          <ul className={styles.rows}>
            {daySessions.map((session) => (
              <SessionRow
                session={session}
                bookedBy={nameFor(session.createdBy)}
                key={session.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
