import { describe, expect, it } from 'vitest';
import type { TrainingSession } from '@/types/fitness';
import { hasUnreadSessions, mapSession, nextSession, type SessionRow } from './sessions';

const session = (id: string, date: string, time: string): TrainingSession => ({
  id,
  date,
  time,
  activity: 'run',
  note: null,
  createdBy: null,
  rsvps: [],
});

describe('mapSession', () => {
  it('shortens the Postgres time to HH:MM', () => {
    const row: SessionRow = {
      id: 's1',
      session_date: '2026-09-26',
      session_time: '07:30:00',
      activity: 'run',
      note: null,
      created_by: null,
    };

    expect(mapSession(row).time).toBe('07:30');
  });

  it('maps RSVP member IDs and statuses', () => {
    const row: SessionRow = {
      id: 's1',
      session_date: '2026-09-26',
      session_time: '07:30:00',
      activity: 'run',
      note: null,
      created_by: null,
      session_rsvps: [{ member_id: 'm1', status: 'going' }],
    };

    expect(mapSession(row).rsvps).toEqual([{ memberId: 'm1', status: 'going' }]);
  });
});

describe('hasUnreadSessions', () => {
  it('only reports bookings newer than the read cursor', () => {
    expect(hasUnreadSessions('2026-09-25T08:30:00.000Z', null)).toBe(true);
    expect(hasUnreadSessions('2026-09-25T08:30:00.000Z', '2026-09-25T08:29:59.000Z')).toBe(true);
    expect(hasUnreadSessions('2026-09-25T08:30:00.000Z', '2026-09-25T08:30:00.000Z')).toBe(false);
    expect(hasUnreadSessions(null, null)).toBe(false);
  });
});

describe('nextSession', () => {
  // 14:00 on 25 Sep 2026.
  const today = '2026-09-25';
  const now = 14 * 60;

  it('picks the soonest still ahead today', () => {
    const found = nextSession([session('a', today, '18:30')], today, now);

    expect(found?.id).toBe('a');
  });

  it('skips a session that already happened today', () => {
    const found = nextSession([session('a', today, '07:00')], today, now);

    expect(found).toBeNull();
  });

  it('includes one starting right now', () => {
    expect(nextSession([session('a', today, '14:00')], today, now)?.id).toBe('a');
  });

  it('falls through to a later day once today is done', () => {
    const found = nextSession(
      [session('past', today, '07:00'), session('tomorrow', '2026-09-26', '07:00')],
      today,
      now
    );

    expect(found?.id).toBe('tomorrow');
  });

  it('ignores anything before today', () => {
    expect(nextSession([session('old', '2026-09-24', '18:30')], today, now)).toBeNull();
  });

  it('returns null when there is nothing booked', () => {
    expect(nextSession([], today, now)).toBeNull();
  });

  it('keeps the query order rather than re-sorting', () => {
    const found = nextSession(
      [session('first', today, '15:00'), session('later', today, '20:00')],
      today,
      now
    );

    expect(found?.id).toBe('first');
  });
});
