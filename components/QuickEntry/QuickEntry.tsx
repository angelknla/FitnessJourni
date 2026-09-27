'use client';

import { CrossIcon, PlusIcon } from '@components/Icons/Icons';
import { useActionState, useEffect, useState } from 'react';
import { type ActionState, saveDailyLog } from '@/app/actions';
import type { DailyLog, Member } from '@/types/fitness';

import styles from './QuickEntry.module.css';

interface QuickEntryProps {
  member: Member;
  log: DailyLog;
  date: string;
}

const initial: ActionState = { ok: true };

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

export const QuickEntry = ({ member, log, date }: QuickEntryProps) => {
  const [state, formAction, isPending] = useActionState(saveDailyLog, initial);
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formId = `daily-log-${member.id}`;

  useEffect(() => {
    if (state.ok) {
      setDirty(false);
    }
  }, [state]);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>Log {member.name}'s day</span>
        {open ? <CrossIcon /> : <PlusIcon />}
      </button>

      {open && (
        <form
          className={styles.form}
          action={formAction}
          id={formId}
          key={`${member.id}-${date}`}
          onChange={(event) => {
            const elements = event.currentTarget.elements;
            setDirty(
              fields.some((field) => {
                const input = elements.namedItem(field.name);
                return input instanceof HTMLInputElement && input.value !== show(log[field.name]);
              })
            );
          }}
        >
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
                  defaultValue={show(log[field.name])}
                />
              </label>
            ))}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.submit} disabled={isPending || !dirty}>
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
