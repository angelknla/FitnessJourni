import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveToken } from './auth';

const cookieStore = {
  value: undefined as string | undefined,
  who: undefined as string | undefined,
};

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === 'fj_unlock' ? cookieStore.value : cookieStore.who;
      return value ? { value } : undefined;
    },
  }),
}));

const { isUnlocked, readViewer } = await import('./session');

describe('isUnlocked', () => {
  beforeEach(() => {
    cookieStore.value = undefined;
    cookieStore.who = undefined;
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

describe('readViewer', () => {
  beforeEach(() => {
    cookieStore.who = undefined;
  });

  it('reports nobody chosen when the cookie is absent, which opens the picker', async () => {
    await expect(readViewer()).resolves.toEqual({ memberId: null, chosen: false });
  });

  /* The distinction the sentinel exists for: choosing to just look is a choice,
     so it must not be asked again on the next load. */
  it('treats the visitor sentinel as chosen, with nobody to write as', async () => {
    cookieStore.who = 'visitor';

    await expect(readViewer()).resolves.toEqual({ memberId: null, chosen: true });
  });

  it('reads a member id back as that member', async () => {
    cookieStore.who = 'aa11bb22-cccc-4ddd-8eee-ff0011223344';

    await expect(readViewer()).resolves.toEqual({
      memberId: 'aa11bb22-cccc-4ddd-8eee-ff0011223344',
      chosen: true,
    });
  });

  it('is independent of the gate cookie', async () => {
    cookieStore.value = await deriveToken('shared-phrase');

    await expect(readViewer()).resolves.toEqual({ memberId: null, chosen: false });
  });
});
