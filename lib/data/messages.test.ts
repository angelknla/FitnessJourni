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
      reactions: [],
    });
  });

  it('maps message reactions', () => {
    expect(
      mapMessage(
        {
          id: 'message-1',
          member_id: 'member-1',
          content: 'Keep showing up.',
          created_at: '2026-09-25T08:30:00.000Z',
        },
        [
          { memberId: 'member-2', type: 'heart' },
          { memberId: 'member-3', type: 'smile' },
        ]
      ).reactions
    ).toEqual([
      { memberId: 'member-2', type: 'heart' },
      { memberId: 'member-3', type: 'smile' },
    ]);
  });

  it('maps a quoted message', () => {
    expect(
      mapMessage(
        {
          id: 'message-2',
          member_id: 'member-2',
          content: 'Absolutely.',
          created_at: '2026-09-25T08:31:00.000Z',
          reply_to_id: 'message-1',
        },
        [],
        { id: 'message-1', memberId: 'member-1', content: 'Keep showing up.' }
      ).replyTo
    ).toEqual({ id: 'message-1', memberId: 'member-1', content: 'Keep showing up.' });
  });

  it('only reports posts newer than the read cursor', () => {
    expect(hasUnreadMessages('2026-09-25T08:30:00.000Z', null)).toBe(true);
    expect(hasUnreadMessages('2026-09-25T08:30:00.000Z', '2026-09-25T08:29:59.000Z')).toBe(true);
    expect(hasUnreadMessages('2026-09-25T08:30:00.000Z', '2026-09-25T08:30:00.000Z')).toBe(false);
    expect(hasUnreadMessages(null, null)).toBe(false);
  });
});
