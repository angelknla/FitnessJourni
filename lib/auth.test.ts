import { describe, expect, it } from 'vitest';
import { deriveToken, tokensMatch } from './auth';

describe('deriveToken', () => {
  it('is deterministic for the same passcode', async () => {
    expect(await deriveToken('park-run-2026')).toBe(await deriveToken('park-run-2026'));
  });

  it('differs for different passcodes', async () => {
    expect(await deriveToken('a')).not.toBe(await deriveToken('b'));
  });

  it('never contains the passcode itself', async () => {
    const token = await deriveToken('park-run-2026');

    expect(token).not.toContain('park');
    expect(token).not.toContain('2026');
  });

  it('is URL-safe base64, so it survives a cookie unescaped', async () => {
    expect(await deriveToken('a/b+c=d')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('tokensMatch', () => {
  it('matches identical tokens', async () => {
    const token = await deriveToken('shared');

    expect(tokensMatch(token, token)).toBe(true);
  });

  it('rejects a different token', async () => {
    expect(tokensMatch(await deriveToken('one'), await deriveToken('two'))).toBe(false);
  });

  it('rejects a length mismatch without throwing', () => {
    expect(tokensMatch('short', 'much-longer-value')).toBe(false);
  });

  it('rejects an empty cookie', async () => {
    expect(tokensMatch('', await deriveToken('shared'))).toBe(false);
  });
});
