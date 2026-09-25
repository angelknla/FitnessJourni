import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveToken } from './auth';

const cookieStore = { value: undefined as string | undefined };

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'fj_unlock' && cookieStore.value ? { value: cookieStore.value } : undefined,
  }),
}));

const { isUnlocked } = await import('./session');

describe('isUnlocked', () => {
  beforeEach(() => {
    cookieStore.value = undefined;
    delete process.env.APP_PASSCODE;
  });

  it('is open when no passcode is configured, so an unset deploy still works', async () => {
    await expect(isUnlocked()).resolves.toBe(true);
  });

  it('is locked when a passcode is set and no cookie is present', async () => {
    process.env.APP_PASSCODE = 'shared-phrase';

    await expect(isUnlocked()).resolves.toBe(false);
  });

  it('unlocks for the cookie derived from the configured passcode', async () => {
    process.env.APP_PASSCODE = 'shared-phrase';
    cookieStore.value = await deriveToken('shared-phrase');

    await expect(isUnlocked()).resolves.toBe(true);
  });

  it('stays locked for a cookie derived from a different passcode', async () => {
    process.env.APP_PASSCODE = 'shared-phrase';
    cookieStore.value = await deriveToken('some-other-phrase');

    await expect(isUnlocked()).resolves.toBe(false);
  });

  it('stays locked for a junk cookie', async () => {
    process.env.APP_PASSCODE = 'shared-phrase';
    cookieStore.value = 'nonsense';

    await expect(isUnlocked()).resolves.toBe(false);
  });

  it('re-locks when the passcode is rotated', async () => {
    process.env.APP_PASSCODE = 'old-phrase';
    cookieStore.value = await deriveToken('old-phrase');
    await expect(isUnlocked()).resolves.toBe(true);

    process.env.APP_PASSCODE = 'new-phrase';
    await expect(isUnlocked()).resolves.toBe(false);
  });
});
