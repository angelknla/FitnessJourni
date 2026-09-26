import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('SleepLogger', () => {
    it('opens a one-decimal sleep input for the active member', async () => {
        const user = userEvent.setup();
        render(
            <SleepLogger member={member} date="2026-09-25" sleepHours={null} canEdit isToday />
        );

        expect(screen.getByText('Sleep not logged today')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: "Log Dillon's sleep" }));

        const input = screen.getByLabelText('Hours slept');
        const save = screen.getByRole('button', { name: 'Save sleep' });
        expect(input).toHaveAttribute('step', '0.1');
        expect(save).toBeDisabled();

        await user.type(input, '7.5');
        expect(save).toBeEnabled();
    });

    it('shows saved sleep and keeps another member read-only', () => {
        render(
            <SleepLogger member={member} date="2026-09-25" sleepHours={7.5} canEdit={false} />
        );

        expect(screen.getByText('7.5 hours')).toBeInTheDocument();
        expect(screen.getByText('Only Dillon can change this.')).toBeInTheDocument();
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