'use client';

import { EyeIcon, EyeOffIcon } from '@components/Icons/Icons';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { type UnlockState, unlock } from '@/app/auth-actions';

import styles from './LoginButton.module.css';

interface LoginButtonProps {
  /** 'header' is the compact one in the top bar; 'primary' is the intro CTA. */
  variant?: 'header' | 'primary';
}

const initial: UnlockState = {};

export const LoginButton = ({ variant = 'header' }: LoginButtonProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(unlock, initial);
  const [revealed, setRevealed] = useState(false);

  // A native <dialog> gives focus trapping, Esc-to-close and a backdrop for free.
  useEffect(() => {
    if (state.ok) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <>
      <button
        type="button"
        className={variant === 'primary' ? styles.primaryTrigger : styles.trigger}
        onClick={() => dialogRef.current?.showModal()}
      >
        Log in
      </button>

      <dialog className={styles.dialog} ref={dialogRef} aria-labelledby="login-heading">
        <form className={styles.form} action={formAction}>
          <h2 className={styles.title} id="login-heading">
            Enter the passcode
          </h2>
          <p className={styles.body}>The one your group shares.</p>

          <label className={styles.field}>
            <span className={styles.label}>Passcode</span>
            <span className={styles.inputWrap}>
              <input
                className={styles.input}
                type={revealed ? 'text' : 'password'}
                name="passcode"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setRevealed((shown) => !shown)}
                aria-label={revealed ? 'Hide passcode' : 'Show passcode'}
                aria-pressed={revealed}
              >
                {revealed ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </span>
          </label>

          {state.error && (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className={styles.submit} disabled={isPending}>
              {isPending ? 'Checking…' : 'Unlock'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
};
