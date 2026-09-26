import { describe, expect, it } from 'vitest';
import { canModifyMessage, MESSAGE_EDIT_WINDOW_MS } from './messagePolicy';

describe('canModifyMessage', () => {
  const sentAt = '2026-09-27T12:00:00.000Z';
  const sentAtMs = new Date(sentAt).getTime();

  it('allows changes through the first 15 minutes', () => {
    expect(canModifyMessage(sentAt, sentAtMs + MESSAGE_EDIT_WINDOW_MS)).toBe(true);
  });

  it('rejects changes after 15 minutes', () => {
    expect(canModifyMessage(sentAt, sentAtMs + MESSAGE_EDIT_WINDOW_MS + 1)).toBe(false);
  });

  it('rejects invalid and future timestamps', () => {
    expect(canModifyMessage('not-a-date', sentAtMs)).toBe(false);
    expect(canModifyMessage(sentAt, sentAtMs - 1)).toBe(false);
  });
});
