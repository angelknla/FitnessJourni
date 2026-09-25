'use client';

import { accentHex, accentNames, nextAccent } from '@data/fitnessData';
import { type CSSProperties, useActionState } from 'react';
import { type ActionState, addMember } from '@/app/actions';
import type { AccentName, Member } from '@/types/fitness';

import styles from './AddMemberForm.module.css';

interface AddMemberFormProps {
  members: Member[];
}

const initial: ActionState = { ok: true };

export const AddMemberForm = ({ members }: AddMemberFormProps) => {
  const [state, formAction, isPending] = useActionState(addMember, initial);

  const used = members.map((member) => member.accent);
  const suggested: AccentName = nextAccent(used);

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="sortOrder" value={members.length} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Add a person</legend>

        <div className={styles.row}>
          <label className={styles.nameField}>
            <span className={styles.fieldLabel}>Name</span>
            <input type="text" name="name" maxLength={40} required autoComplete="off" />
          </label>

          <label className={styles.colourField}>
            <span className={styles.fieldLabel}>Colour</span>
            <select name="accent" defaultValue={suggested}>
              {accentNames.map((accent) => (
                <option value={accent} key={accent} disabled={used.includes(accent)}>
                  {accent}
                  {used.includes(accent) ? ' — taken' : ''}
                </option>
              ))}
            </select>
          </label>

          <span
            className={styles.preview}
            style={{ '--member-accent': accentHex[suggested] } as CSSProperties}
            aria-hidden="true"
          />
        </div>

        <p className={styles.hint}>
          Targets start at the playbook defaults — 2,500 kcal, 156 g protein, 10k steps, 2.5 L — and
          can be changed per person later.
        </p>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" disabled={isPending}>
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
