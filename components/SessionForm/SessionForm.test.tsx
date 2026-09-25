import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/types/fitness';

// Mocked so the real module (and next/cache with it) stays out of jsdom.
vi.mock('@/app/actions', () => ({
  bookSession: vi.fn(async () => ({ ok: true })),
}));

import { SessionForm } from './SessionForm';

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

describe('SessionForm', () => {
  it('offers every activity type', () => {
    render(<SessionForm members={members} />);

    for (const label of ['Run', 'Workout', 'Swim', 'Walk', 'Cycle', 'Other']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('defaults to a run, since that is the usual case', () => {
    render(<SessionForm members={members} />);

    expect(screen.getByRole('radio', { name: 'Run' })).toBeChecked();
  });

  it('switches the selected activity', async () => {
    const user = userEvent.setup();
    render(<SessionForm members={members} />);

    await user.click(screen.getByRole('radio', { name: 'Swim' }));

    expect(screen.getByRole('radio', { name: 'Swim' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Run' })).not.toBeChecked();
  });

  it('builds a 14-day rail once the browser clock is known, with today preselected', () => {
    render(<SessionForm members={members} />);

    const days = screen.getAllByRole('radio', { name: /\d/ });
    expect(days).toHaveLength(14);

    // Today is the first card and starts selected. The radio itself is labelled
    // with the full date; "Today" is the visible shorthand on the card.
    expect(days[0]).toBeChecked();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('lets a quick-time chip set the time', async () => {
    const user = userEvent.setup();
    render(<SessionForm members={members} />);

    const time = screen.getByLabelText('Time') as HTMLInputElement;
    expect(time.value).toBe('07:00');

    await user.click(screen.getByRole('button', { name: '18:30' }));

    expect(time.value).toBe('18:30');
  });

  it('lists everyone as a possible booker, plus an anyone option', () => {
    render(<SessionForm members={members} />);

    const who = screen.getByLabelText('Booked by');

    expect(who).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Anyone' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dillon' })).toBeInTheDocument();
  });
});
