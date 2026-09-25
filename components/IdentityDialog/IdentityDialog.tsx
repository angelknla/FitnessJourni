'use client';

import { accentHex } from '@data/fitnessData';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { type IdentityState, signInAs } from '@/app/auth-actions';
import { VIEWER_VISITOR } from '@/lib/auth';
import type { AccentName } from '@/types/fitness';
import {
  MemberCreateForm,
  type MemberCreateOption,
} from '../AddMemberForm/MemberCreateForm';

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
  const [mode, setMode] = useState<'identity' | 'create'>('identity');
  const [created, setCreated] = useState<MemberCreateOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleMemberAdded = useCallback((member: MemberCreateOption) => {
    setCreated(member);
    setPicked(member.id);
    setMode('identity');
  }, []);

  const closeDialog = useCallback(() => {
    setMode('identity');
    setCreated(null);
    setPickerOpen(false);
    onClose();
  }, [onClose]);

  // Driven by the `open` prop rather than an imperative ref, so the header and
  // the add-person form can each decide when it shows without reaching in here.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      setMode('identity');
      setCreated(null);
      setPickerOpen(false);
      setPicked(presetId ?? viewerId ?? VIEWER_VISITOR);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, presetId, viewerId]);

  useEffect(() => {
    if (state.ok) {
      closeDialog();
      window.scrollTo({ top: 0, behavior: 'instant' });
      router.refresh();
    }
  }, [state.ok, closeDialog, router]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [pickerOpen]);

  const options =
    created && !members.some((member) => member.id === created.id) ? [...members, created] : members;
  const promptTitle = created ? `${created.name} is in` : title;
  const promptBody = created
    ? `Start logging as ${created.name}, or stay as ${viewerId ? 'you are' : 'a visitor'}.`
    : body;
  const promptDismissLabel = created ? (viewerId ? 'Stay as I am' : 'Stay visitor') : dismissLabel;
  const promptSubmitLabel = created ? `Log in as ${created.name}` : submitLabel;
  const selectedMember = options.find((member) => member.id === picked);
  const selectedName = selectedMember?.name ?? 'Visitor';
  const selectedStatus = selectedMember
    ? selectedMember.id === viewerId
      ? 'signed in'
      : ''
    : 'look, don’t log';

  const chooseIdentity = (memberId: string) => {
    setPicked(memberId);
    setPickerOpen(false);
  };

  return (
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      aria-labelledby={headingId}
      /* Esc and the backdrop close it natively, so the parent's state has to be
         told rather than left thinking it is still open. */
      onClose={closeDialog}
    >
      {mode === 'create' ? (
        <div className={styles.form}>
          <h2 className={styles.title} id={headingId}>
            New user
          </h2>
          <p className={styles.body}>Add yourself to the group, then choose how to continue.</p>
          <MemberCreateForm
            members={options}
            embedded
            onCancel={() => setMode('identity')}
            onMemberAdded={handleMemberAdded}
          />
        </div>
      ) : (
        <form className={styles.form} action={formAction}>
          <h2 className={styles.title} id={headingId}>
            {promptTitle}
          </h2>
          <p className={styles.body}>{promptBody}</p>

          <div className={styles.picker} ref={pickerRef}>
            <input type="hidden" name="memberId" value={picked} />
            <button
              type="button"
              className={styles.pickerTrigger}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((current) => !current)}
            >
              <span
                className={styles.dot}
                data-visitor={!selectedMember || undefined}
                style={
                  selectedMember
                    ? ({ '--option-accent': accentHex[selectedMember.accent] } as CSSProperties)
                    : undefined
                }
              />
              <span className={styles.optionName}>{selectedName}</span>
              {selectedStatus && <span className={styles.current}>{selectedStatus}</span>}
              <span className={styles.chevron} aria-hidden="true" />
            </button>

            {pickerOpen && (
              <div className={styles.dropdown}>
                <div className={styles.options} role="listbox" aria-label={promptTitle}>
                  {options.map((member) => (
                    <button
                      type="button"
                      className={styles.option}
                      role="option"
                      aria-selected={picked === member.id}
                      key={member.id}
                      style={{ '--option-accent': accentHex[member.accent] } as CSSProperties}
                      onClick={() => chooseIdentity(member.id)}
                    >
                      <span className={styles.dot} />
                      <span className={styles.optionName}>{member.name}</span>
                      {member.id === viewerId && <span className={styles.current}>signed in</span>}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={styles.option}
                    role="option"
                    aria-selected={picked === VIEWER_VISITOR}
                    data-visitor
                    onClick={() => chooseIdentity(VIEWER_VISITOR)}
                  >
                    <span className={styles.dot} />
                    <span className={styles.optionName}>Visitor</span>
                    <span className={styles.current}>look, don’t log</span>
                  </button>
                </div>

                {!created && (
                  <button
                    type="button"
                    className={`${styles.option} ${styles.newUser}`}
                    onClick={() => {
                      setPickerOpen(false);
                      setMode('create');
                    }}
                  >
                    <span className={styles.addMark} aria-hidden="true">
                      +
                    </span>
                    <span className={styles.optionName}>New user</span>
                    <span className={styles.current}>add yourself</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {state.error && (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              {promptDismissLabel}
            </button>
            <button type="submit" className={styles.submit} disabled={isPending}>
              {isPending ? 'Saving…' : promptSubmitLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
};
