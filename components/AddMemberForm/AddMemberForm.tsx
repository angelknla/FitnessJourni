'use client';

import { IdentityDialog, type IdentityOption } from '@components/IdentityDialog/IdentityDialog';
import { accentHex, accentNames, nextAccent } from '@data/fitnessData';
import { type CSSProperties, useActionState, useState } from 'react';
import { type ActionState, addMember } from '@/app/actions';
import type { AccentName, Member } from '@/types/fitness';

import styles from './AddMemberForm.module.css';

interface AddMemberFormProps {
  members: Member[];
  /** Who is adding, so the prompt afterwards can say what staying means. */
  viewerId: string | null;
}

const initial: ActionState = { ok: false };

export const AddMemberForm = ({ members, viewerId }: AddMemberFormProps) => {
  const [state, formAction, isPending] = useActionState(addMember, initial);
  /*
   * Which new person's prompt has been waved away. Keyed by id rather than a
   * boolean so adding a second person asks again instead of staying silent.
   */
  const [dismissed, setDismissed] = useState<string | null>(null);

  const used = members.map((member) => member.accent);
  /*
   * Swatches rather than a dropdown: the point of choosing a colour is seeing it,
   * and the previous preview dot read from a value computed once, so it never
   * followed the selection.
   */
  const [accent, setAccent] = useState<AccentName>(nextAccent(used));

  /*
   * Offered to whoever did the adding, visitor included — a visitor creating the
   * first person is the only way a fresh deploy gets its first identity.
   */
  const prompted =
    state.newMemberId && state.newMemberName && state.newMemberId !== dismissed
      ? { id: state.newMemberId, name: state.newMemberName }
      : null;

  /*
   * The revalidate usually brings the new person back in `members` before this
   * renders, but not dependably, so they are added if still missing — otherwise
   * the prompt would preselect someone the list does not contain.
   */
  const options: IdentityOption[] =
    prompted && !members.some((member) => member.id === prompted.id)
      ? [...members, { id: prompted.id, name: prompted.name, accent }]
      : members;

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

      {prompted && (
        <IdentityDialog
          members={options}
          viewerId={viewerId}
          presetId={prompted.id}
          open
          onClose={() => setDismissed(prompted.id)}
          title={`${prompted.name} is in`}
          body={`Carry on as you are, or start logging as ${prompted.name}.`}
          dismissLabel="Stay as I am"
          submitLabel={`Log in as ${prompted.name}`}
        />
      )}
    </form>
  );
};
