import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  verifyPassword,
} from './account';

describe('account credentials', () => {
  it('normalizes usernames and email addresses', () => {
    expect(normalizeUsername('  Angel.Fit ')).toBe('angel.fit');
    expect(normalizeEmail(' Angel@Example.COM ')).toBe('angel@example.com');
  });

  it('validates account fields', () => {
    expect(isValidUsername('angel_1')).toBe(true);
    expect(isValidUsername('an')).toBe(false);
    expect(isValidUsername('angel space')).toBe(false);
    expect(isValidEmail('angel@example.com')).toBe(true);
    expect(isValidEmail('angel')).toBe(false);
    expect(isValidPassword('password')).toBe(true);
    expect(isValidPassword('short')).toBe(false);
  });

  it('hashes passwords with a salt and verifies them', async () => {
    const first = await hashPassword('friend-password');
    const second = await hashPassword('friend-password');

    expect(first).not.toBe(second);
    expect(await verifyPassword('friend-password', first)).toBe(true);
    expect(await verifyPassword('wrong-password', first)).toBe(false);
  });
});
