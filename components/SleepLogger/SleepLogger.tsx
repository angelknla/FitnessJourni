'use client';

import { CrossIcon, PlusIcon } from '@components/Icons/Icons';
import { type SaveAction, useBackgroundSave } from '@hooks/useBackgroundSave';
import { useEffect, useRef, useState } from 'react';
import { saveSleep } from '@/app/actions';
import ui from '@/styles/ui.module.css';
import type { Member } from '@/types/fitness';

import styles from './SleepLogger.module.css';

interface SleepLoggerProps {
  member: Member;
  date: string;
  sleepHours: number | null;
  canEdit: boolean;
  isToday?: boolean;
  save?: SaveAction;
}

const hoursFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const formatHours = (hours: number, target: number) =>
  `${hoursFormat.format(hours)} / ${hoursFormat.format(target)} hours`;

export const SleepLogger = ({
  member,
  date,
  sleepHours,
  canEdit,
  isToday = true,
  save,
}: SleepLoggerProps) => {
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(sleepHours === null ? '' : String(sleepHours));
  const disclosureRef = useRef<HTMLDivElement>(null);
  const returnScrollRef = useRef<number | null>(null);
  const {
    state,
    pending: isPending,
    submit,
  } = useBackgroundSave(
    save ?? ((data) => saveSleep({ ok: false }, data)),
    () => setFormOpen(false),
    () => setFormOpen(true)
  );
  const hasSleep = sleepHours !== null;
  const formId = `sleep-log-${member.id}`;
  const parsedDraft = Number(draft);
  const canSave =
    draft !== '' &&
    Number.isFinite(parsedDraft) &&
    parsedDraft >= 0.1 &&
    parsedDraft <= 24 &&
    parsedDraft !== sleepHours;

  useEffect(() => {
    if (formOpen) {
      if (returnScrollRef.current === null) return;

      const frame = requestAnimationFrame(() => {
        disclosureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      return () => cancelAnimationFrame(frame);
    }

    if (returnScrollRef.current === null) return;

    const returnScroll = returnScrollRef.current;
    returnScrollRef.current = null;

    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: returnScroll, behavior: 'smooth' });
    });

    return () => cancelAnimationFrame(frame);
  }, [formOpen]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.status}>
        <span className={styles.badge} data-done={hasSleep}>
          {hasSleep
            ? isToday
              ? 'Sleep logged today'
              : 'Sleep logged on this day'
            : isToday
              ? 'Sleep not logged today'
              : 'Sleep not logged on this day'}
        </span>
        {hasSleep && (
          <strong className={styles.duration}>
            {formatHours(sleepHours, member.targets.sleepHours ?? 8)}
          </strong>
        )}
      </div>

      {canEdit && (
        <div className={styles.disclosure} ref={disclosureRef}>
          <button
            type="button"
            className={`${ui.entryToggle} ${ui.primaryButton}`}
            aria-expanded={formOpen}
            aria-controls={formId}
            disabled={isPending}
            onClick={() => {
              if (!formOpen && !state.error)
                setDraft(sleepHours === null ? '' : String(sleepHours));
              if (!formOpen && window.matchMedia('(max-width: 599px)').matches) {
                returnScrollRef.current = window.scrollY;
              }
              setFormOpen((open) => !open);
            }}
          >
            <span>{hasSleep ? 'Update sleep' : 'Log your sleep'}</span>
            {formOpen ? <CrossIcon /> : <PlusIcon />}
          </button>

          {formOpen && (
            <form className={styles.form} onSubmit={submit} id={formId}>
              <input type="hidden" name="memberId" value={member.id} />
              <input type="hidden" name="date" value={date} />
              <label className={styles.field}>
                <span>Hours slept</span>
                <input
                  type="number"
                  name="sleepHours"
                  min="0.1"
                  max="24"
                  step="0.1"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="7.5"
                  inputMode="decimal"
                  required
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={`${ui.entrySubmit} ${ui.primaryButton}`}
                  disabled={isPending || !canSave}
                >
                  {isPending ? 'Saving…' : 'Save sleep'}
                </button>
                {state.error && (
                  <p className={styles.error} role="alert">
                    {state.error}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
