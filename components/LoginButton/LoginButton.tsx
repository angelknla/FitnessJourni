'use client';

import { MemberCreateForm } from '@components/AddMemberForm/MemberCreateForm';
import { EyeIcon, EyeOffIcon } from '@components/Icons/Icons';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import {
  claimLegacyAccount,
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
type Mode = 'login' | 'passcode' | 'legacy' | 'create';
type EnrollmentIntent = 'legacy' | 'create';

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
  const [claimState, claimAction, claimPending] = useActionState(
    claimLegacyAccount,
    initialIdentity
  );
  const [mode, setMode] = useState<Mode>('login');
  const [enrollmentIntent, setEnrollmentIntent] = useState<EnrollmentIntent>('legacy');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (loginState.ok || claimState.ok) {
      dialogRef.current?.close();
      router.replace('/');
    }
  }, [claimState.ok, loginState.ok, router]);

  useEffect(() => {
    if (unlockState.ok) setMode(enrollmentIntent);
  }, [enrollmentIntent, unlockState.ok]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setMode('login');
    setRevealed(false);
  }, []);

  const startEnrollment = (intent: EnrollmentIntent) => {
    setEnrollmentIntent(intent);
    setMode(unlockState.ok ? intent : 'passcode');
  };

  const finishNewAccount = useCallback(() => {
    dialogRef.current?.close();
    router.replace('/');
  }, [router]);

  const passwordField = (autoComplete: 'current-password' | 'new-password') => (
    <label className={styles.field}>
      <span className={styles.label}>Password</span>
      <span className={styles.inputWrap}>
        <input
          className={styles.input}
          type={revealed ? 'text' : 'password'}
          name="password"
          minLength={autoComplete === 'new-password' ? 8 : undefined}
          maxLength={128}
          autoComplete={autoComplete}
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
        {mode === 'login' && (
          <form className={styles.form} action={loginAction}>
            <h2 className={styles.title} id="login-heading">Log in</h2>
            <p className={styles.body}>Use your username or email and your own password.</p>
            <label className={styles.field}>
              <span className={styles.label}>Username or email</span>
              <input name="login" autoCapitalize="none" autoComplete="username" required />
            </label>
            {passwordField('current-password')}
            {loginState.error && <p className={styles.error} role="alert">{loginState.error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={close}>Cancel</button>
              <button type="submit" className={styles.submit} disabled={loginPending}>
                {loginPending ? 'Logging in…' : 'Log in'}
              </button>
            </div>
            <div className={styles.alternatives}>
              <button
                type="button"
                className={styles.existingAccount}
                aria-label="Set up existing account"
                onClick={() => startEnrollment('legacy')}
              >
                Existing account
              </button>
              <button
                type="button"
                className={styles.newAccount}
                aria-label="Create new user"
                onClick={() => startEnrollment('create')}
              >
                New user
              </button>
            </div>
          </form>
        )}

        {mode === 'passcode' && (
          <form className={styles.form} action={unlockAction}>
            <h2 className={styles.title} id="login-heading">Enter app passcode</h2>
            <p className={styles.body}>
              Required before {enrollmentIntent === 'create' ? 'creating a user' : 'claiming an existing user'}.
            </p>
            <label className={styles.field}>
              <span className={styles.label}>App passcode</span>
              <input type="password" name="passcode" autoComplete="off" required />
            </label>
            {unlockState.error && <p className={styles.error} role="alert">{unlockState.error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setMode('login')}>Back</button>
              <button type="submit" className={styles.submit} disabled={unlockPending}>
                {unlockPending ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {mode === 'legacy' && (
          <form className={styles.form} action={claimAction}>
            <h2 className={styles.title} id="login-heading">Set up existing account</h2>
            <p className={styles.body}>Choose your current display name. Your existing data stays with you.</p>
            {unlockState.legacyMembers?.length ? (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>Current user</span>
                  <select name="memberId" required defaultValue="">
                    <option value="" disabled>Select your name</option>
                    {unlockState.legacyMembers.map((member) => (
                      <option value={member.id} key={member.id}>{member.name}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Username</span>
                  <input name="username" minLength={3} maxLength={30} autoCapitalize="none" autoComplete="username" required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <input type="email" name="email" autoComplete="email" required />
                </label>
                {passwordField('new-password')}
                {claimState.error && <p className={styles.error} role="alert">{claimState.error}</p>}
                <div className={styles.actions}>
                  <button type="button" className={styles.cancel} onClick={() => setMode('login')}>Back</button>
                  <button type="submit" className={styles.submit} disabled={claimPending}>
                    {claimPending ? 'Saving…' : 'Create login'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.body}>Every existing user already has login details.</p>
                <button type="button" onClick={() => setMode('login')}>Back to login</button>
              </>
            )}
          </form>
        )}

        {mode === 'create' && (
          <div className={styles.form}>
            <h2 className={styles.title} id="login-heading">Create new user</h2>
            <p className={styles.body}>Your display name is what friends will see throughout the app.</p>
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
