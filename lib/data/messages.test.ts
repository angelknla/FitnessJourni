import { describe, expect, it } from 'vitest';
import { hasUnreadMessages, mapMessage } from './messages';

describe('messages', () => {
  it('maps database rows to message posts', () => {
    expect(
      mapMessage({
        id: 'message-1',
        member_id: 'member-1',
        content: 'Keep showing up.',
        created_at: '2026-09-25T08:30:00.000Z',
      })
    ).toEqual({
      id: 'message-1',
      memberId: 'member-1',
      content: 'Keep showing up.',
      createdAt: '2026-09-25T08:30:00.000Z',
    });
  });

  it('only reports posts newer than the read cursor', () => {
    expect(hasUnreadMessages('2026-09-25T08:30:00.000Z', null)).toBe(true);
    expect(hasUnreadMessages('2026-09-25T08:30:00.000Z', '2026-09-25T08:29:59.000Z')).toBe(true);
    expect(hasUnreadMessages('2026-09-25T08:30:00.000Z', '2026-09-25T08:30:00.000Z')).toBe(false);
    expect(hasUnreadMessages(null, null)).toBe(false);
  });
});
