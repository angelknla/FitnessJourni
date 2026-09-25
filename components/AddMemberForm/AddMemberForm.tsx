'use client';

import { accentHex, accentNames, nextAccent } from '@data/fitnessData';
import { type CSSProperties, useActionState, useState } from 'react';
import { type ActionState, addMember } from '@/app/actions';
import type { AccentName, Member } from '@/types/fitness';

import styles from './AddMemberForm.module.css';

interface AddMemberFormProps {
  members: Member[];
}

const initial: ActionState = { ok: false };

export const AddMemberForm = ({ members }: AddMemberFormProps) => {
  const [state, formAction, isPending] = useActionState(addMember, initial);

  const used = members.map((member) => member.accent);
  /*
   * Swatches rather than a dropdown: the point of choosing a colour is seeing it,
   * and the previous preview dot read from a value computed once, so it never
   * followed the selection.
   */
  const [accent, setAccent] = useState<AccentName>(nextAccent(used));

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="sortOrder" value={members.length} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Add a person</legend>

        <label className={styles.nameField}>
          <span className={styles.fieldLabel}>Name</span>
          <input type="text" name="name" maxLength={40} required autoComplete="off" />
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLabel}>Colour</legend>

        <div className={styles.swatches}>
          {accentNames.map((option) => {
            const taken = used.includes(option);

            return (
              <label
                className={styles.swatch}
                key={option}
                style={{ '--swatch': accentHex[option] } as CSSProperties}
              >
                <input
                  className={styles.control}
                  type="radio"
                  name="accent"
                  value={option}
                  checked={accent === option}
                  disabled={taken}
                  aria-label={taken ? `${option} — already taken` : option}
                  onChange={() => setAccent(option)}
                />
                <span className={styles.dot} />
              </label>
            );
          })}
        </div>

        <p className={styles.chosen}>
          Chosen: <strong className={styles.chosenName}>{accent}</strong>
        </p>
      </fieldset>

      <p className={styles.hint}>
        Targets start at the playbook defaults — 2,500 kcal, 156 g protein, 10k steps, 2.5 L — and
        can be changed per person later.
      </p>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isPending}>
          {isPending ? 'Adding…' : 'Add person'}
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
