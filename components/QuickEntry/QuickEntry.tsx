'use client';

import ui from '@/styles/ui.module.css';

import { CrossIcon, PlusIcon } from '@components/Icons/Icons';
import { useBackgroundSave, type SaveAction } from '@hooks/useBackgroundSave';
import { useEffect, useRef, useState } from 'react';
import { saveDailyLog } from '@/app/actions';
import type { DailyLog, Member } from '@/types/fitness';

import styles from './QuickEntry.module.css';

interface QuickEntryProps {
  member: Member;
  log: DailyLog;
  date: string;
  save?: SaveAction;
}

/** Blank beats a 0 the user has to clear before typing. */
const show = (value: number) => (value === 0 ? '' : String(value));

const fields = [
  { name: 'steps', label: 'Steps', max: 200000, step: 1 },
  { name: 'waterMl', label: 'Water (ml)', max: 20000, step: 50 },
  // step is 1 on every food figure: a coarser one made the browser reject any
  // number in between, so 543 kcal came back asking for 540 or 550.
  { name: 'calories', label: 'Calories', max: 20000, step: 1 },
  { name: 'proteinG', label: 'Protein (g)', max: 1000, step: 1 },
  { name: 'carbsG', label: 'Carbs (g)', max: 2000, step: 1 },
  { name: 'fatG', label: 'Fat (g)', max: 1000, step: 1 },
] as const;

export const QuickEntry = ({ member, log, date, save }: QuickEntryProps) => {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.name, show(log[field.name])]))
  );
  const {
    state,
    pending: isPending,
    submit,
  } = useBackgroundSave(
    save ?? ((data) => saveDailyLog({ ok: false }, data)),
    () => {
      setDirty(false);
      setOpen(false);
    },
    () => {
      setDirty(true);
      setOpen(true);
    }
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const returnScrollRef = useRef<number | null>(null);
  const formId = `daily-log-${member.id}`;

  useEffect(() => {
    if (open) {
      if (returnScrollRef.current === null) return;

      const frame = requestAnimationFrame(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${ui.entryToggle} ${ui.primaryButton}`}
        aria-expanded={open}
        aria-controls={formId}
        disabled={isPending}
        onClick={() => {
          if (!open && !state.error)
            setDraft(
              Object.fromEntries(fields.map((field) => [field.name, show(log[field.name])]))
            );
          if (!open && window.matchMedia('(max-width: 599px)').matches) {
            returnScrollRef.current = window.scrollY;
          }
          setOpen((current) => !current);
        }}
      >
        <span>Log your day</span>
        {open ? <CrossIcon /> : <PlusIcon />}
      </button>

      {open && (
        <form className={styles.form} onSubmit={submit} id={formId} key={`${member.id}-${date}`}>
          <input type="hidden" name="memberId" value={member.id} />
          <input type="hidden" name="date" value={date} />

          <div className={styles.grid}>
            {fields.map((field) => (
              <label className={styles.field} key={field.name}>
                <span className={styles.fieldLabel}>{field.label}</span>
                <input
                  type="number"
                  name={field.name}
                  inputMode="numeric"
                  min={0}
                  max={field.max}
                  step={field.step}
                  placeholder="0"
                  value={draft[field.name]}
                  onChange={(event) => {
                    const next = { ...draft, [field.name]: event.target.value };
                    setDraft(next);
                    setDirty(fields.some((entry) => next[entry.name] !== show(log[entry.name])));
                  }}
                />
              </label>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={`${ui.entrySubmit} ${ui.primaryButton}`}
              disabled={isPending || !dirty}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>

            {state.error && (
              <p className={styles.error} role="alert">
                {state.error}
              </p>
            )}
            {state.ok && state.message && (
              <p className={styles.success} role="status">
                {state.message}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
