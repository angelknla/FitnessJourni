'use client';

import ui from '@/styles/ui.module.css';

import { useActionState } from 'react';
import { linkMemberByUsername, type ActionState } from '@/app/actions';

import styles from './AddMemberForm.module.css';

interface AddMemberFormProps {
  viewerId: string | null;
}

export const AddMemberForm = ({ viewerId }: AddMemberFormProps) => {
  const initial: ActionState = { ok: false };
  const [state, formAction, isPending] = useActionState(linkMemberByUsername, initial);

  return (
    <form className={styles.form} action={formAction}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Link a user</legend>
        <label className={styles.nameField}>
          <span className={styles.fieldLabel}>Username</span>
          <input
            type="text"
            name="username"
            minLength={3}
            maxLength={30}
            autoCapitalize="none"
            autoComplete="off"
            required
          />
        </label>
      </fieldset>
      <p className={styles.hint}>Enter the username of an existing FitnessJourni account.</p>
      <div className={styles.actions}>
        <button
          type="submit"
          className={`${styles.submit} ${ui.primaryButton}`}
          disabled={isPending || !viewerId}
        >
          {isPending ? 'Linking…' : 'Link user'}
        </button>
        {(state.error || state.message) && (
          <p className={state.error ? styles.error : styles.success} role="status">
            {state.error ?? state.message}
          </p>
        )}
      </div>
    </form>
  );
};
