import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Member, Workout } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
  logWorkout: vi.fn(async () => ({ ok: false })),
  deleteWorkout: vi.fn(async () => ({ ok: false })),
}));

import { WorkoutLogger } from './WorkoutLogger';

const member: Member = {
  id: 'm1',
  name: 'Dillon',
  accent: 'blue',
  sortOrder: 0,
  targets: {
    calories: 2500,
    protein: 156,
    carbs: 313,
    fat: 69,
    steps: 10000,
    stepsMin: 8000,
    waterMl: 2500,
    workoutsPerWeek: 4,
  },
};

const workout = (id: string, focuses: Workout['focuses'], note: string | null = null): Workout => ({
  id,
  memberId: 'm1',
  date: '2026-09-25',
  focuses,
  note,
});

const setup = (logged: Workout[] = [], weekCount = 0, canEdit = true) =>
  render(
    <WorkoutLogger
      member={member}
      date="2026-09-25"
      logged={logged}
      weekCount={weekCount}
      canEdit={canEdit}
    />
  );

const openForm = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getByRole('button', { name }));
};

describe('WorkoutLogger', () => {
  it('says nothing is logged when the day is empty', () => {
    setup();

    expect(screen.getByText('Not logged today')).toBeInTheDocument();
  });

  it('confirms training once something is logged', () => {
    setup([workout('w1', ['push'])]);

    expect(screen.getByText('Trained today')).toBeInTheDocument();
  });

  it('counts toward the recommended weekly figure', () => {
    setup([], 2);

    expect(screen.getByText('2 of 4 this week')).toBeInTheDocument();
  });

  it('reframes rather than showing a nonsense "6 of 4" once past the recommendation', () => {
    setup([], 6);

    expect(screen.queryByText('6 of 4 this week')).not.toBeInTheDocument();
    expect(screen.getByText('6 this week · 4 recommended')).toBeInTheDocument();
  });

  it('treats hitting the recommendation exactly as met', () => {
    setup([], 4);

    expect(screen.getByText('4 this week · 4 recommended')).toBeInTheDocument();
  });

  it('lets several areas be picked for one session', async () => {
    const user = userEvent.setup();
    setup();
    await openForm(user, /What did you train/);

    await user.click(screen.getByRole('checkbox', { name: 'Push' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cardio' }));

    expect(screen.getByRole('checkbox', { name: 'Push' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cardio' })).toBeChecked();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('cannot submit until something is picked', async () => {
    const user = userEvent.setup();
    setup();
    await openForm(user, /What did you train/);

    const submit = screen.getByRole('button', { name: 'Log workout' });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Legs' }));
    expect(submit).toBeEnabled();
  });

  it('shows a multi-focus session as one entry', () => {
    setup([workout('w1', ['push', 'cardio'])]);

    expect(screen.getByText('Push + Cardio')).toBeInTheDocument();
  });

  it('lists two sessions on the same day separately', () => {
    setup([workout('w1', ['push']), workout('w2', ['cardio'])], 2);

    expect(screen.getByRole('button', { name: 'Remove Push workout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Cardio workout' })).toBeInTheDocument();
  });

  it('invites another session once one is logged', () => {
    setup([workout('w1', ['push'])]);

    expect(screen.getByRole('button', { name: 'Log another session' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('checkbox', { name: 'Push' })).not.toBeInTheDocument();
  });
});
