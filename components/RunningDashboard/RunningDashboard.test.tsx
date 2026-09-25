import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GroupRun, Member } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
    logRun: vi.fn(async () => ({ ok: true })),
    deleteRun: vi.fn(async () => ({ ok: true })),
}));

import { RunningDashboard } from './RunningDashboard';

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
];

const runs: GroupRun[] = [
    {
        id: 'r1',
        date: '2026-09-25',
        durationMinutes: 31,
        distanceKm: 5,
        paceSecondsPerKm: 345,
        createdBy: 'm1',
        attendeeIds: ['m1', 'm2'],
    },
    {
        id: 'r2',
        date: '2026-09-20',
        durationMinutes: 65,
        distanceKm: 10,
        paceSecondsPerKm: null,
        createdBy: 'm2',
        attendeeIds: ['m1'],
    },
];

const setup = (viewerId: string | null = 'm1') =>
    render(
        <RunningDashboard
            members={members}
            runs={runs}
            tallies={{
                m1: { week: 2, month: 2 },
                m2: { week: 1, month: 1 },
            }}
            viewerId={viewerId}
            today="2026-09-25"
        />
    );

describe('RunningDashboard', () => {
    it('leads with visual group highlights and member tallies', () => {
        setup();

        const highlights = screen.getByRole('region', { name: 'Running highlights' });
        expect(highlights).toHaveTextContent('15.0 km');
        expect(within(highlights).getByText('this week · 2 runs').previousElementSibling).toHaveTextContent('15.0 km');

        const tallies = screen.getByRole('region', { name: 'Runs by person' });
        expect(within(tallies).getAllByRole('listitem')).toHaveLength(2);
        expect(within(tallies).getByText('Dillon').closest('li')).toHaveTextContent('2/2');
    });

    it('shows distance, calculated pace, time and attendees for recent runs', () => {
        setup();

        expect(screen.getByText('5.00')).toBeInTheDocument();
        expect(screen.getByText('5:45 /km')).toBeInTheDocument();
        expect(screen.getByText('31m')).toBeInTheDocument();
        expect(screen.getAllByText('Angel').length).toBeGreaterThan(0);
    });

    it('previews pace as duration and distance change', async () => {
        const user = userEvent.setup();
        setup();

        expect(screen.getByText('6:00 /km')).toBeInTheDocument();
        const minutes = screen.getByRole('spinbutton', { name: 'min' });
        await user.clear(minutes);
        await user.type(minutes, '25');
        expect(screen.getByText('5:00 /km')).toBeInTheDocument();
    });

    it('uses an optional manual pace in the preview', async () => {
        const user = userEvent.setup();
        setup();

        await user.type(screen.getByRole('spinbutton', { name: 'min/km' }), '5');
        await user.type(screen.getByRole('spinbutton', { name: 'sec/km' }), '30');

        expect(screen.getByText('Manual pace')).toBeInTheDocument();
        expect(screen.getByText('5:30 /km')).toBeInTheDocument();
    });

    it('preselects the logger and offers the other members as attendees', () => {
        setup();

        expect(screen.getByRole('checkbox', { name: 'Dillon' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Dillon' })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: 'Angel' })).not.toBeChecked();
    });

    it('only lets the creator remove their run', () => {
        setup();

        expect(screen.getByRole('button', { name: 'Remove 5.00 kilometre run' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove 10.00 kilometre run' })).not.toBeInTheDocument();
    });

    it('hides the logging form and all remove actions from visitors', () => {
        setup(null);

        expect(screen.queryByRole('heading', { name: 'Log a run' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Remove .* kilometre run/ })).not.toBeInTheDocument();
    });
});