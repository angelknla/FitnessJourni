'use client';

import { accentHex } from '@data/fitnessData';
import { type CSSProperties, useActionState, useEffect, useId, useRef, useState } from 'react';
import { type ActionState, removeMember } from '@/app/actions';
import type { Member } from '@/types/fitness';

import styles from './RemoveMemberDialog.module.css';

interface RemoveMemberDialogProps {
  members: Member[];
  /** Who is doing the removing, so the warning can say when it is themselves. */
  viewerId: string | null;
  /** Admins choose a target; everyone else can only confirm removing themselves. */
  canRemoveOthers?: boolean;
  open: boolean;
  onClose: () => void;
}

const initial: ActionState = { ok: false };

export const RemoveMemberDialog = ({
  members,
  viewerId,
  canRemoveOthers = false,
  open,
  onClose,
}: RemoveMemberDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [state, formAction, isPending] = useActionState(removeMember, initial);
  const [picked, setPicked] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      // Never reopen with a previous choice still armed.
      setPicked(canRemoveOthers ? '' : (viewerId ?? ''));
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [canRemoveOthers, open, viewerId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  useEffect(() => {
    if (state.ok) {
      if (dialogRef.current?.open) {
        dialogRef.current.close();
      }
      onClose();
    }
  }, [state.ok, onClose]);

  const target = members.find((member) => member.id === picked);

  return (
    <dialog className={styles.dialog} ref={dialogRef} aria-labelledby={headingId} onClose={onClose}>
      <form className={styles.form} action={formAction}>
        <h2 className={styles.title} id={headingId}>
          {canRemoveOthers ? 'Remove someone' : 'Remove your account'}
        </h2>
        <p className={styles.body}>
          {canRemoveOthers
            ? 'This deletes the person and every day and workout they have logged. Sessions they booked stay, credited to nobody. It cannot be undone.'
            : 'This deletes your account and every day and workout you have logged. Sessions you booked stay, credited to nobody. It cannot be undone.'}
        </p>

        {canRemoveOthers ? (
          <fieldset className={styles.fieldset}>
            <legend className="sr-only">Who to remove</legend>

            {members.map((member) => (
              <label
                className={styles.option}
                key={member.id}
                style={{ '--option-accent': accentHex[member.accent] } as CSSProperties}
              >
                <input
                  className={styles.control}
                  type="radio"
                  name="memberId"
                  value={member.id}
                  checked={picked === member.id}
                  onChange={() => setPicked(member.id)}
                />
                <span className={styles.dot} />
                <span className={styles.optionName}>{member.name}</span>
                {member.id === viewerId && <span className={styles.you}>you</span>}
              </label>
            ))}
          </fieldset>
        ) : (
          <input type="hidden" name="memberId" value={picked} />
        )}

        {target?.id === viewerId && (
          <p className={styles.warning}>
            That is you. Removing yourself drops your own history and hands the app back to the
            picker.
          </p>
        )}

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          {/* Names the person, so the irreversible click is never a generic one. */}
          <button type="submit" className={styles.submit} disabled={isPending || !target}>
            {isPending ? 'Removing…' : target ? `Remove ${target.name}` : 'Remove'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
