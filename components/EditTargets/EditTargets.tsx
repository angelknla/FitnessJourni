'use client';

import { useActionState, useEffect, useState } from 'react';
import { type ActionState, updateTargets } from '@/app/actions';
import type { Member } from '@/types/fitness';

import styles from './EditTargets.module.css';

interface EditTargetsProps {
  member: Member;
  id: string;
  onSaved: () => void;
}

/** Deliberately not { ok: true }, so state.ok only becomes true after a real save. */
const initial: ActionState = { ok: false };

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

export const EditTargets = ({ member, id, onSaved }: EditTargetsProps) => {
  const [state, formAction, isPending] = useActionState(updateTargets, initial);

  const [protein, setProtein] = useState(String(member.targets.protein));
  const [carbs, setCarbs] = useState(String(member.targets.carbs));
  const [fat, setFat] = useState(String(member.targets.fat));

  useEffect(() => {
    if (state.ok) {
      onSaved();
    }
  }, [state.ok, onSaved]);

  const num = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  // Macros and calories are the same budget counted two ways, so a mismatch is
  // worth showing rather than letting the two drift apart silently.
  const impliedKcal =
    num(protein) * KCAL_PER_G.protein + num(carbs) * KCAL_PER_G.carbs + num(fat) * KCAL_PER_G.fat;
  const drift = impliedKcal - member.targets.calories;
  const driftsALot = Math.abs(drift) > 100;

  const fields = [
    { name: 'protein', label: 'Protein (g)', value: protein, set: setProtein, max: 1000 },
    { name: 'carbs', label: 'Carbs (g)', value: carbs, set: setCarbs, max: 2000 },
    { name: 'fat', label: 'Fat (g)', value: fat, set: setFat, max: 1000 },
  ];

  return (
    <form className={styles.form} action={formAction} id={id}>
      <input type="hidden" name="memberId" value={member.id} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{member.name}'s macro targets</legend>

        <div className={styles.grid}>
          {fields.map((field) => (
            <label className={styles.field} key={field.name}>
              <span className={styles.fieldLabel}>{field.label}</span>
              <input
                type="number"
                name={field.name}
                inputMode="numeric"
                min={1}
                max={field.max}
                required
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <p className={styles.implied} data-drift={driftsALot}>
        These macros come to <strong>{impliedKcal.toLocaleString('en-GB')} kcal</strong>
        {driftsALot
          ? ` — ${Math.abs(drift).toLocaleString('en-GB')} ${drift > 0 ? 'over' : 'under'} the ${member.targets.calories.toLocaleString('en-GB')} kcal target.`
          : `, in line with the ${member.targets.calories.toLocaleString('en-GB')} kcal target.`}
      </p>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save targets'}
        </button>
        <button type="button" className={styles.cancel} onClick={onSaved}>
          Cancel
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
