import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/types/fitness';

vi.mock('@/app/actions', () => ({ addMember: vi.fn(async () => ({ ok: false })) }));

import { AddMemberForm } from './AddMemberForm';

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
  { id: 'm3', name: 'Bradley', accent: 'aqua', sortOrder: 2, targets },
];

describe('AddMemberForm', () => {
  it('offers a swatch per accent slot', () => {
    render(<AddMemberForm members={members} />);

    expect(screen.getAllByRole('radio')).toHaveLength(8);
  });

  it('preselects the next free colour rather than one already in use', () => {
    render(<AddMemberForm members={members} />);

    expect(screen.getByRole('radio', { name: 'yellow' })).toBeChecked();
  });

  it('disables colours already taken, so two people cannot share one', () => {
    render(<AddMemberForm members={members} />);

    expect(screen.getByRole('radio', { name: 'blue — already taken' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'orange — already taken' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'yellow' })).toBeEnabled();
  });

  it('reflects a new choice, both in the radio and in the label', async () => {
    const user = userEvent.setup();
    render(<AddMemberForm members={members} />);

    expect(screen.getByText('yellow')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'violet' }));

    expect(screen.getByRole('radio', { name: 'violet' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'yellow' })).not.toBeChecked();
    expect(screen.getByText('violet')).toBeInTheDocument();
  });

  it('requires a name', () => {
    render(<AddMemberForm members={members} />);

    expect(screen.getByLabelText('Name')).toBeRequired();
  });

  it('passes the sort order so a new person lands at the end', () => {
    const { container } = render(<AddMemberForm members={members} />);

    expect(container.querySelector('input[name="sortOrder"]')).toHaveValue('3');
  });
});
