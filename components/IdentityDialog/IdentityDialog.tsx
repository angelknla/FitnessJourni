'use client';

import { accentHex } from '@data/fitnessData';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useActionState, useEffect, useId, useRef, useState } from 'react';
import { type IdentityState, signInAs } from '@/app/auth-actions';
import { VIEWER_VISITOR } from '@/lib/auth';
import type { AccentName } from '@/types/fitness';

import styles from './IdentityDialog.module.css';

/**
 * Only what the list needs to draw. Looser than Member on purpose, so the
 * add-person form can offer someone it has just created and holds no targets for.
 */
export interface IdentityOption {
  id: string;
  name: string;
  accent: AccentName;
}

interface IdentityDialogProps {
  members: IdentityOption[];
  /** Who this browser is acting as now; null for a visitor. */
  viewerId: string | null;
  open: boolean;
  onClose: () => void;
  /** Preselect someone other than the current viewer — the person just added. */
  presetId?: string;
  title?: string;
  body?: string;
  /** The dismiss button reads differently when the dialog is offering a switch. */
  dismissLabel?: string;
  submitLabel?: string;
}

const initial: IdentityState = {};

export const IdentityDialog = ({
  members,
  viewerId,
  open,
  onClose,
  presetId,
  title = 'Who are you?',
  body = 'Pick yourself to log your own day. Everyone can see everyone; only you can change yours.',
  dismissLabel = 'Cancel',
  submitLabel = 'Continue',
}: IdentityDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const headingId = useId();
  const [state, formAction, isPending] = useActionState(signInAs, initial);
  const [picked, setPicked] = useState(presetId ?? viewerId ?? VIEWER_VISITOR);

  // Driven by the `open` prop rather than an imperative ref, so the header and
  // the add-person form can each decide when it shows without reaching in here.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      setPicked(presetId ?? viewerId ?? VIEWER_VISITOR);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, presetId, viewerId]);

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
  }, [state.ok, onClose, router]);

  return (
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      aria-labelledby={headingId}
      /* Esc and the backdrop close it natively, so the parent's state has to be
         told rather than left thinking it is still open. */
      onClose={onClose}
    >
      <form className={styles.form} action={formAction}>
        <h2 className={styles.title} id={headingId}>
          {title}
        </h2>
        <p className={styles.body}>{body}</p>

        <fieldset className={styles.fieldset}>
          <legend className="sr-only">{title}</legend>

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
              {member.id === viewerId && <span className={styles.current}>signed in</span>}
            </label>
          ))}

          <label className={styles.option} data-visitor>
            <input
              className={styles.control}
              type="radio"
              name="memberId"
              value={VIEWER_VISITOR}
              checked={picked === VIEWER_VISITOR}
              onChange={() => setPicked(VIEWER_VISITOR)}
            />
            <span className={styles.dot} />
            <span className={styles.optionName}>Visitor</span>
            <span className={styles.current}>look, don’t log</span>
          </label>
        </fieldset>

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            {dismissLabel}
          </button>
          <button type="submit" className={styles.submit} disabled={isPending}>
            {isPending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
};
