import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/auth-actions', () => ({
  loginWithCredentials: vi.fn(async () => ({})),
  unlockEnrollment: vi.fn(async () => ({})),
  claimLegacyAccount: vi.fn(async () => ({})),
}));
vi.mock('@/app/actions', () => ({ addMember: vi.fn(async () => ({ ok: false })) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

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
  it('keeps the password field out of the page until asked for', () => {
    render(<LoginButton />);

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('opens the modal on click', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('open');
    expect(screen.getByLabelText('Username or email')).toBeRequired();
    expect(screen.getAllByRole('button', { name: 'Log in' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Set up existing account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create new user' })).toBeInTheDocument();
    expect(screen.queryByText('Visitor')).not.toBeInTheDocument();
  });

  it('masks what is typed', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('can be dismissed without guessing', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('offers a close control with the same dismiss behavior', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.click(screen.getByRole('button', { name: 'Close login' }));

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('requires the app passcode before either enrollment path', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.click(screen.getByRole('button', { name: 'Create new user' }));

    expect(screen.getByRole('heading', { name: 'Enter app passcode' })).toBeInTheDocument();
    expect(screen.getByLabelText('App passcode')).toBeRequired();
  });

  it('renders a primary variant for the intro screen', () => {
    render(<LoginButton variant="primary" />);

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('LoginButton password reveal', () => {
  it('starts masked and toggles to visible and back', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');

    const reveal = screen.getByRole('button', { name: 'Show password' });
    expect(reveal).toHaveAttribute('aria-pressed', 'false');

    await user.click(reveal);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('keeps what was typed when toggling visibility', async () => {
    const user = userEvent.setup();
    render(<LoginButton />);

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.type(screen.getByLabelText('Password'), 'secret-phrase');
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveValue('secret-phrase');
  });
});
