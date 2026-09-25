import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainingSession } from '@/types/fitness';
import { SessionBanner } from './SessionBanner';

const session: TrainingSession = {
  id: 's1',
  date: '2026-09-26',
  time: '18:30',
  activity: 'run',
  note: 'Meet at the park gate',
  createdBy: 'm1',
};

beforeEach(() => {
  window.localStorage.clear();
});

const setup = (over: Partial<TrainingSession> = {}, bookedBy?: string) =>
  render(
    <SessionBanner
      session={{ ...session, ...over }}
      bookedBy={bookedBy}
      whenLabel="Saturday 26 at 18:30"
    />
  );

describe('SessionBanner', () => {
  it('announces the next session', () => {
    setup({}, 'Dillon');

    expect(screen.getByRole('complementary', { name: 'Next session' })).toBeInTheDocument();
    expect(screen.getByText('Run · Saturday 26 at 18:30')).toBeInTheDocument();
    expect(screen.getByText('Meet at the park gate')).toBeInTheDocument();
    expect(screen.getByText('Booked by Dillon')).toBeInTheDocument();
  });

  it('omits the note and booker when there are none', () => {
    setup({ note: null, createdBy: null });

    expect(screen.queryByText(/Booked by/)).not.toBeInTheDocument();
    expect(screen.queryByText('Meet at the park gate')).not.toBeInTheDocument();
  });

  it('links through to the sessions page', () => {
    setup();

    expect(screen.getByRole('link', { name: 'See all sessions' })).toHaveAttribute(
      'href',
      '/sessions'
    );
  });

  it('disappears when dismissed', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('stays dismissed on a later visit', async () => {
    const user = userEvent.setup();
    const first = setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    first.unmount();

    setup();

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('comes back for a different session, so dismissing one does not silence the next', async () => {
    const user = userEvent.setup();
    const first = setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    first.unmount();

    setup({ id: 's2' });

    expect(screen.getByRole('complementary', { name: 'Next session' })).toBeInTheDocument();
  });

  it('still shows when storage is unavailable', () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    setup();

    expect(screen.getByRole('complementary', { name: 'Next session' })).toBeInTheDocument();
    getItem.mockRestore();
  });

  it('does not throw when storage refuses a write', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    setItem.mockRestore();
  });
});
