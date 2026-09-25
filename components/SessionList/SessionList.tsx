'use client';

import { CrossIcon } from '@components/Icons/Icons';
import { activityLabels } from '@data/fitnessData';
import { fromISODate } from '@utils/date';
import { useActionState } from 'react';
import { type ActionState, deleteSession, respondToSession } from '@/app/actions';
import type { Member, RsvpStatus, TrainingSession } from '@/types/fitness';

import styles from './SessionList.module.css';

interface SessionListProps {
  sessions: TrainingSession[];
  members: Member[];
  viewerId: string | null;
}

const initial: ActionState = { ok: true };

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Own component so each row gets its own action state without hooks in a loop. */
const SessionRow = ({
  session,
  members,
  viewerId,
  bookedBy,
}: {
  session: TrainingSession;
  members: Member[];
  viewerId: string | null;
  bookedBy?: string;
}) => {
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteSession, initial);
  const [rsvpState, rsvpAction, isResponding] = useActionState(respondToSession, initial);
  const currentStatus = session.rsvps.find((rsvp) => rsvp.memberId === viewerId)?.status;
  const namesFor = (status: RsvpStatus) =>
    members
      .filter((member) =>
        session.rsvps.some((rsvp) => rsvp.memberId === member.id && rsvp.status === status)
      )
      .map((member) => member.name);
  const going = namesFor('going');
  const notGoing = namesFor('not_going');

  return (
    <li className={styles.row}>
      <span className={styles.time}>{session.time}</span>

      <span className={styles.details}>
        <span className={styles.activity}>{activityLabels[session.activity]}</span>
        {session.note && <span className={styles.note}>{session.note}</span>}
        {bookedBy && <span className={styles.by}>Booked by {bookedBy}</span>}
        {(going.length > 0 || notGoing.length > 0) && (
          <span className={styles.responses}>
            {going.length > 0 && <span>Going: {going.join(', ')}</span>}
            {notGoing.length > 0 && <span>Can't go: {notGoing.join(', ')}</span>}
          </span>
        )}
        {viewerId && (
          <form action={rsvpAction} className={styles.rsvp} aria-label="RSVP">
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="memberId" value={viewerId} />
            <button
              type="submit"
              name="status"
              value="going"
              data-active={currentStatus === 'going'}
              aria-pressed={currentStatus === 'going'}
              disabled={isResponding}
            >
              Going
            </button>
            <button
              type="submit"
              name="status"
              value="not_going"
              data-active={currentStatus === 'not_going'}
              aria-pressed={currentStatus === 'not_going'}
              disabled={isResponding}
            >
              Can't go
            </button>
          </form>
        )}
        {rsvpState.error && (
          <span className={styles.error} role="alert">
            {rsvpState.error}
          </span>
        )}
        {deleteState.error && (
          <span className={styles.error} role="alert">
            {deleteState.error}
          </span>
        )}
      </span>

      <form action={deleteAction}>
        <input type="hidden" name="id" value={session.id} />
        <button
          type="submit"
          className={styles.remove}
          disabled={isDeleting}
          aria-label={`Remove ${activityLabels[session.activity]} at ${session.time}`}
        >
          {isDeleting ? <span className={styles.pending}>…</span> : <CrossIcon size={14} />}
        </button>
      </form>
    </li>
  );
};

export const SessionList = ({ sessions, members, viewerId }: SessionListProps) => {
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
                members={members}
                viewerId={viewerId}
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
