import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Header } from './Header';

describe('Header', () => {
  it('renders the brand link', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'FitnessJourni' })).toHaveAttribute('href', '/');
  });

  it('starts with the mobile menu collapsed', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('toggles the mobile menu open and closed', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const closeButton = screen.getByRole('button', { name: 'Close menu' });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(closeButton);
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('closes the menu when a nav link is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('link', { name: 'Sessions' }));

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });
});
