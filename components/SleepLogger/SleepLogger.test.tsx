import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Member } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
  saveSleep: vi.fn(async () => ({ ok: true })),
}));

import { SleepLogger } from './SleepLogger';

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

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }) as MediaQueryList)
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SleepLogger', () => {
  it.each([
    ['Update sleep', 7.5, 'toggle'],
    ['Update sleep', 7.5, 'save'],
    ['Log your sleep', null, 'toggle'],
    ['Log your sleep', null, 'save'],
  ] as const)('centres %s on mobile and restores the previous scroll after %s hours closes by %s', async (label, hours, closeBy) => {
    const user = userEvent.setup();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    vi.stubGlobal('scrollY', 420);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<SleepLogger member={member} date="2026-09-25" sleepHours={hours} canEdit />);
    const toggle = screen.getByRole('button', { name: label });
    const scrollIntoView = vi.fn();
    Object.defineProperty(toggle.parentElement, 'scrollIntoView', { value: scrollIntoView });

    await user.click(toggle);
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    vi.stubGlobal('scrollY', 700);
    if (closeBy === 'save') {
      const input = screen.getByLabelText('Hours slept');
      await user.clear(input);
      await user.type(input, '8');
      await user.click(screen.getByRole('button', { name: 'Save sleep' }));
    } else {
      await user.click(toggle);
    }

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'smooth' });
    });
  });

  it('opens a one-decimal sleep input for the active member', async () => {
    const user = userEvent.setup();
    render(<SleepLogger member={member} date="2026-09-25" sleepHours={null} canEdit isToday />);

    expect(screen.getByText('Sleep not logged today')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log your sleep' }));

    const input = screen.getByLabelText('Hours slept');
    const save = screen.getByRole('button', { name: 'Save sleep' });
    expect(input).toHaveAttribute('step', '0.1');
    expect(save).toBeDisabled();

    await user.type(input, '7.5');
    expect(save).toBeEnabled();
  });

  it('shows saved sleep and keeps another member read-only', () => {
    render(<SleepLogger member={member} date="2026-09-25" sleepHours={7.5} canEdit={false} />);

    expect(screen.getByText('7.5 / 8 hours')).toBeInTheDocument();
    expect(screen.queryByText(/Only Dillon can/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update sleep' })).not.toBeInTheDocument();
  });

  it('keeps Save disabled until an existing duration changes', async () => {
    const user = userEvent.setup();
    render(<SleepLogger member={member} date="2026-09-25" sleepHours={7.5} canEdit />);

    await user.click(screen.getByRole('button', { name: 'Update sleep' }));
    const input = screen.getByLabelText('Hours slept');
    const save = screen.getByRole('button', { name: 'Save sleep' });
    expect(save).toBeDisabled();

    await user.clear(input);
    expect(save).toBeDisabled();
    await user.type(input, '8');
    expect(save).toBeEnabled();
  });
});
