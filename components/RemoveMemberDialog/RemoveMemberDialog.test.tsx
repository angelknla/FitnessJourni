import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Member, MemberTargets } from '@/types/fitness';

vi.mock('@/app/actions', () => ({ removeMember: vi.fn(async () => ({ ok: false })) }));

import { RemoveMemberDialog } from './RemoveMemberDialog';

const targets: MemberTargets = {
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
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  }
});

const setup = (props: Partial<Parameters<typeof RemoveMemberDialog>[0]> = {}) =>
  render(
    <RemoveMemberDialog
      members={members}
      viewerId="m2"
      canRemoveOthers
      open
      onClose={vi.fn()}
      {...props}
    />
  );

describe('RemoveMemberDialog', () => {
  it('lists everyone, and marks which one is you', () => {
    setup();

    expect(screen.getByRole('radio', { name: /Dillon/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Bradley/ })).toBeInTheDocument();
    expect(screen.getByText('you')).toBeInTheDocument();
  });

  it('says what removal actually destroys', () => {
    setup();

    expect(screen.getByText(/every day and workout they have logged/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
  });

  /* Nothing is preselected, so the destructive button cannot be reached by
     opening the dialog and hitting Enter. */
  it('cannot submit until someone is chosen', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('names the person on the button once chosen', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('radio', { name: /Bradley/ }));

    expect(screen.getByRole('button', { name: 'Remove Bradley' })).toBeEnabled();
  });

  it('warns when the chosen person is you', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('radio', { name: /Angel/ }));

    expect(screen.getByText(/That is you/)).toBeInTheDocument();
  });

  it('gives non-admins a self-only confirmation without a member picker', () => {
    const { container } = setup({ viewerId: 'm1', canRemoveOthers: false });

    expect(screen.getByRole('heading', { name: 'Remove your account' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(container.querySelector('form')).toHaveFormValues({ memberId: 'm1' });
    expect(screen.getByRole('button', { name: 'Remove Dillon' })).toBeEnabled();
  });

  it('submits the chosen id', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    await user.click(screen.getByRole('radio', { name: /Dillon/ }));

    expect(container.querySelector('form')).toHaveFormValues({ memberId: 'm1' });
  });

  it('closes without removing anyone', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    setup({ onClose });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
