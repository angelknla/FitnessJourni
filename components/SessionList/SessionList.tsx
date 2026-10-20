'use client';


import { BinIcon } from '@components/Icons/Icons';
import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { activityLabels } from '@data/fitnessData';
import { fromISODate } from '@utils/date';
import { useActionState, useEffect, useState } from 'react';
import { type ActionState, deleteSession, respondToSession } from '@/app/actions';
import { SESSION_GRACE_MINUTES } from '@/lib/data/sessions';
import ui from '@/styles/ui.module.css';
import type { Member, RsvpStatus, TrainingSession } from '@/types/fitness';

import styles from './SessionList.module.css';

interface SessionListProps {
  sessions: TrainingSession[];
  members: Member[];
  viewerId: string | null;
  initialNow: number;
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
  const membersFor = (status: RsvpStatus) =>
    members.filter((member) =>
      session.rsvps.some((rsvp) => rsvp.memberId === member.id && rsvp.status === status)
    );
  const going = membersFor('going');
  const notGoing = membersFor('not_going');

  return (
    <li className={`${styles.row} ${ui.card}`}>
      <span className={styles.time}>{session.time}</span>

      <span className={styles.details}>
        <span className={styles.activity}>{activityLabels[session.activity]}</span>
        {session.note && <span className={styles.note}>{session.note}</span>}
        {bookedBy && <span className={styles.by}>Booked by {bookedBy}</span>}
        {(going.length > 0 || notGoing.length > 0) && (
          <span className={styles.responses}>
            {going.length > 0 && (
              <span
                className={styles.responseGroup}
                role="img"
                aria-label={`Going: ${going.map((member) => member.name).join(', ')}`}
              >
                <span>Going:</span>
                <span className={styles.responseAvatars}>
                  {going.map((member) => (
                    <span key={member.id} title={member.name}>
                      <MemberAvatar member={member} size="1.15rem" />
                    </span>
                  ))}
                </span>
              </span>
            )}
            {notGoing.length > 0 && (
              <span
                className={styles.responseGroup}
                role="img"
                aria-label={`Can't go: ${notGoing.map((member) => member.name).join(', ')}`}
              >
                <span>Can't go:</span>
                <span className={styles.responseAvatars}>
                  {notGoing.map((member) => (
                    <span key={member.id} title={member.name}>
                      <MemberAvatar member={member} size="1.15rem" />
                    </span>
                  ))}
                </span>
              </span>
            )}
          </span>
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

      <form action={deleteAction} className={styles.removeForm}>
        <input type="hidden" name="id" value={session.id} />
        <button
          type="submit"
          className={styles.remove}
          disabled={isDeleting}
          aria-label={`Remove ${activityLabels[session.activity]} at ${session.time}`}
        >
          {isDeleting ? <span className={styles.pending}>…</span> : <BinIcon size={14} />}
        </button>
      </form>
    </li>
  );
};

const expiresAt = (session: TrainingSession) =>
  new Date(`${session.date}T${session.time}:00`).getTime() + SESSION_GRACE_MINUTES * 60 * 1000;

export const SessionList = ({ sessions, members, viewerId, initialNow }: SessionListProps) => {
  const [now, setNow] = useState(initialNow);
  const visibleSessions = sessions.filter((session) => expiresAt(session) > now);

  useEffect(() => {
    const current = Math.max(now, Date.now());
    const nextExpiry = Math.min(
      ...sessions.map(expiresAt).filter((expiry) => expiry > current)
    );
    if (!Number.isFinite(nextExpiry)) return;

    const timeout = window.setTimeout(() => setNow(Date.now()), nextExpiry - current + 50);
    return () => window.clearTimeout(timeout);
  }, [sessions, now]);

  if (visibleSessions.length === 0) {
    return <p className={styles.empty}>Nothing booked yet. Pick a day below and get one in.</p>;
  }

  const nameFor = (id: string | null) =>
    id ? members.find((member) => member.id === id)?.name : undefined;

  // Already ordered by the query; a Map keeps that order while grouping.
  const days = new Map<string, TrainingSession[]>();
  for (const session of visibleSessions) {
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
