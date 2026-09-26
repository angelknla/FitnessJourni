import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
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

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:avatar-preview');
  URL.revokeObjectURL = vi.fn();
});

describe('AddMemberForm', () => {
  it('offers a swatch per accent slot', () => {
    render(<AddMemberForm members={members} viewerId="m1" />);

    expect(within(screen.getByRole('group', { name: 'Colour' })).getAllByRole('radio')).toHaveLength(12);
  });

  it('preselects the next free colour rather than one already in use', () => {
    render(<AddMemberForm members={members} viewerId="m1" />);

    expect(screen.getByRole('radio', { name: 'yellow' })).toBeChecked();
  });

  it('disables colours already taken, so two people cannot share one', () => {
    render(<AddMemberForm members={members} viewerId="m1" />);

    expect(screen.getByRole('radio', { name: 'blue — already taken' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'orange — already taken' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'yellow' })).toBeEnabled();
  });

  it('reflects a new choice, both in the radio and in the label', async () => {
    const user = userEvent.setup();
    render(<AddMemberForm members={members} viewerId="m1" />);

    expect(screen.getByText('yellow')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'violet' }));

    expect(screen.getByRole('radio', { name: 'violet' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'yellow' })).not.toBeChecked();
    expect(screen.getByText('violet')).toBeInTheDocument();
  });

  it('requires a name', () => {
    render(<AddMemberForm members={members} viewerId="m1" />);

    expect(screen.getByLabelText('Name')).toBeRequired();
  });

  it('passes the sort order so a new person lands at the end', () => {
    const { container } = render(<AddMemberForm members={members} viewerId="m1" />);

    expect(container.querySelector('input[name="sortOrder"]')).toHaveValue('3');
  });

  it('offers initial and built-in profile pictures', async () => {
    const user = userEvent.setup();
    render(<AddMemberForm members={members} viewerId="m1" />);

    const pictures = within(screen.getByRole('group', { name: 'Profile picture' }));
    expect(pictures.getAllByRole('radio')).toHaveLength(8);
    expect(pictures.getByRole('radio', { name: 'Initial' })).toBeChecked();

    await user.click(pictures.getByRole('radio', { name: 'Tempo' }));
    expect(pictures.getByRole('radio', { name: 'Tempo' })).toBeChecked();
    expect(pictures.getByRole('radio', { name: 'Initial' })).not.toBeChecked();
  });

  it('allows a profile photo upload during creation', async () => {
    const user = userEvent.setup();
    render(<AddMemberForm members={members} viewerId="m1" />);

    const upload = screen.getByLabelText('Upload photo');
    await user.click(screen.getByText('Upload photo'));
    expect(screen.getByRole('radio', { name: 'Uploaded photo' })).toBeChecked();

    await user.upload(upload, new File(['photo'], 'profile.png', { type: 'image/png' }));

    expect((upload as HTMLInputElement).files).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Uploaded photo' })).toBeChecked();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('radio', { name: 'Tempo' }));
    expect((upload as HTMLInputElement).files).toHaveLength(0);
    expect(screen.getByRole('radio', { name: 'Tempo' })).toBeChecked();
  });
});
