import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member, TrainingSession } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
  deleteSession: vi.fn(async () => ({ ok: true })),
  respondToSession: vi.fn(async () => ({ ok: true })),
}));

import { SessionList } from './SessionList';

const targets = {
  calories: 2500,
  protein: 156,
  carbs: 313,
  fat: 69,
  steps: 10000,
  stepsMin: 8000,
  waterMl: 2500,
  workoutsPerWeek: 4,
};

const members: Member[] = [
  { id: 'm1', name: 'Dillon', accent: 'blue', sortOrder: 0, targets },
  { id: 'm2', name: 'Angel', accent: 'orange', sortOrder: 1, targets },
];

const sessions: TrainingSession[] = [
  {
    id: 's1',
    date: '2026-09-26',
    time: '07:30',
    activity: 'run',
    note: 'Park gate',
    createdBy: 'm1',
    rsvps: [
      { memberId: 'm1', status: 'going' },
      { memberId: 'm2', status: 'not_going' },
    ],
  },
  {
    id: 's2',
    date: '2026-09-26',
    time: '18:00',
    activity: 'swim',
    note: null,
    createdBy: null,
    rsvps: [],
  },
  {
    id: 's3',
    date: '2026-09-27',
    time: '09:00',
    activity: 'walk',
    note: null,
    createdBy: 'm1',
    rsvps: [],
  },
];

describe('SessionList', () => {
  it('invites a first booking when empty', () => {
    render(<SessionList sessions={[]} members={members} viewerId="m1" />);

    expect(screen.getByText(/Nothing booked yet/)).toBeInTheDocument();
  });

  it('groups sessions under one heading per day', () => {
    render(<SessionList sessions={sessions} members={members} viewerId="m1" />);

    expect(screen.getByRole('heading', { name: 'Saturday 26 September' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sunday 27 September' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(2);
  });

  it('shows the time, activity and note', () => {
    render(<SessionList sessions={sessions} members={members} viewerId="m1" />);

    expect(screen.getByText('07:30')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('Park gate')).toBeInTheDocument();
  });

  it('names who booked it, and stays quiet when nobody claimed it', () => {
    render(<SessionList sessions={sessions} members={members} viewerId="m1" />);

    expect(screen.getAllByText('Booked by Dillon')).toHaveLength(2);
    expect(screen.queryByText(/Booked by null/)).not.toBeInTheDocument();
  });

  it('gives each row a distinctly labelled remove button', () => {
    render(<SessionList sessions={sessions} members={members} viewerId="m1" />);

    expect(screen.getByRole('button', { name: 'Remove Run at 07:30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Swim at 18:00' })).toBeInTheDocument();
  });

  it('shows responses and marks the current member response', () => {
    render(<SessionList sessions={sessions} members={members} viewerId="m1" />);

    expect(screen.getByText('Going: Dillon')).toBeInTheDocument();
    expect(screen.getByText("Can't go: Angel")).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Going' })[0]).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('does not offer RSVP controls to a visitor', () => {
    render(<SessionList sessions={sessions} members={members} viewerId={null} />);

    expect(screen.queryByRole('form', { name: 'RSVP' })).not.toBeInTheDocument();
  });
});
