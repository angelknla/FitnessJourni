import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/auth-actions', () => ({ unlock: vi.fn(async () => ({})) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { LoginButton } from './LoginButton';

beforeAll(() => {
  // jsdom does not implement the modal side of <dialog>.
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

describe('LoginButton', () => {
  it('keeps the passcode field out of the page until asked for', () => {
    render(<LoginButton />);

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('opens the modal on click', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('open');
  });

  it('masks what is typed', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByLabelText('Passcode')).toHaveAttribute('type', 'password');
  });

  it('can be dismissed without guessing', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('renders a primary variant for the intro screen', () => {
    render(<LoginButton variant="primary" />);

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});
