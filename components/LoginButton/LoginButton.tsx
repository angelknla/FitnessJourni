'use client';

import { MemberCreateForm } from '@components/AddMemberForm/MemberCreateForm';
import { CrossIcon, EyeIcon, EyeOffIcon } from '@components/Icons/Icons';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import {
  type IdentityState,
  loginWithCredentials,
  type UnlockState,
  unlockEnrollment,
} from '@/app/auth-actions';

import styles from './LoginButton.module.css';

interface LoginButtonProps {
  /** 'header' is the compact one in the top bar; 'primary' is the intro CTA. */
  variant?: 'header' | 'primary';
}

const initialUnlock: UnlockState = {};
const initialIdentity: IdentityState = {};
type Mode = 'login' | 'passcode' | 'create';

export const LoginButton = ({ variant = 'header' }: LoginButtonProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [loginState, loginAction, loginPending] = useActionState(
    loginWithCredentials,
    initialIdentity
  );
  const [unlockState, unlockAction, unlockPending] = useActionState(
    unlockEnrollment,
    initialUnlock
  );
  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (loginState.ok) {
      dialogRef.current?.close();
      router.replace('/');
    }
  }, [loginState.ok, router]);

  useEffect(() => {
    if (unlockState.ok) setMode('create');
  }, [unlockState.ok]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setMode('login');
    setRevealed(false);
  }, []);

  const finishNewAccount = useCallback(() => {
    dialogRef.current?.close();
    router.replace('/');
  }, [router]);

  const passwordField = (
    <label className={styles.field}>
      <span className={styles.label}>Password</span>
      <span className={styles.inputWrap}>
        <input
          className={styles.input}
          type={revealed ? 'text' : 'password'}
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={128}
          autoComplete="current-password"
          required
        />
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setRevealed((shown) => !shown)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
        >
          {revealed ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
        </button>
      </span>
    </label>
  );

  return (
    <>
      <button
        type="button"
        className={variant === 'primary' ? styles.primaryTrigger : styles.trigger}
        onClick={() => {
          setMode('login');
          dialogRef.current?.showModal();
        }}
      >
        Log in
      </button>

      <dialog className={styles.dialog} ref={dialogRef} aria-labelledby="login-heading">
        <button
          type="button"
          className={styles.closeButton}
          onClick={close}
          aria-label="Close login"
          title="Close"
        >
          <CrossIcon size={15} />
        </button>
        {mode === 'login' && (
          <form className={styles.form} action={loginAction}>
            <h2 className={styles.title} id="login-heading">
              Log in
            </h2>
            <p className={styles.body}>Use your username or email and your own password.</p>
            <label className={styles.field}>
              <span className={styles.label}>Username or email</span>
              <input
                name="login"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                required
              />
            </label>
            {passwordField}
            {loginState.error && (
              <p className={styles.error} role="alert">
                {loginState.error}
              </p>
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={close}>
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submit}
                disabled={loginPending || !login.trim() || !password}
              >
                {loginPending ? 'Logging in…' : 'Log in'}
              </button>
            </div>
            <div className={styles.alternatives}>
              <button
                type="button"
                className={styles.newAccount}
                aria-label="Create new user"
                onClick={() => setMode(unlockState.ok ? 'create' : 'passcode')}
              >
                New user
              </button>
            </div>
          </form>
        )}

        {mode === 'passcode' && (
          <form className={styles.form} action={unlockAction}>
            <h2 className={styles.title} id="login-heading">
              Enter app passcode
            </h2>
            <p className={styles.body}>Required before creating a user.</p>
            <label className={styles.field}>
              <span className={styles.label}>App passcode</span>
              <input type="password" name="passcode" autoComplete="off" required />
            </label>
            {unlockState.error && (
              <p className={styles.error} role="alert">
                {unlockState.error}
              </p>
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setMode('login')}>
                Back
              </button>
              <button type="submit" className={styles.submit} disabled={unlockPending}>
                {unlockPending ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {mode === 'create' && (
          <div className={styles.form}>
            <h2 className={styles.title} id="login-heading">
              Create new user
            </h2>
            <p className={styles.body}>
              Your display name is what friends will see throughout the app.
            </p>
            <MemberCreateForm
              members={unlockState.members ?? []}
              embedded
              onCancel={() => setMode('login')}
              onMemberAdded={finishNewAccount}
            />
          </div>
        )}
      </dialog>
    </>
  );
};
