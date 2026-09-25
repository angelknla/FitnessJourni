'use client';

import { useActionState } from 'react';
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
  { name: 'calories', label: 'Calories', max: 20000, step: 10 },
  { name: 'proteinG', label: 'Protein (g)', max: 1000, step: 1 },
  { name: 'carbsG', label: 'Carbs (g)', max: 2000, step: 1 },
  { name: 'fatG', label: 'Fat (g)', max: 1000, step: 1 },
] as const;

export const QuickEntry = ({ member, log, date }: QuickEntryProps) => {
  const [state, formAction, isPending] = useActionState(saveDailyLog, initial);

  return (
    // Remounts on member change so the inputs reload with that person's numbers.
    <form className={styles.form} action={formAction} key={`${member.id}-${date}`}>
      <input type="hidden" name="memberId" value={member.id} />
      <input type="hidden" name="date" value={date} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Log {member.name}'s day</legend>

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
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </button>

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
};
