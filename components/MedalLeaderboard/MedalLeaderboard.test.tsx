import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedalAward } from '@/lib/aggregate';
import type { MedalBoard } from '@/lib/medals';
import type { Member } from '@/types/fitness';
import { MedalLeaderboard, MemberMedals } from './MedalLeaderboard';

const push = vi.fn();

vi.mock('next/navigation', () => ({
    usePathname: () => '/',
    useRouter: () => ({ push }),
    useSearchParams: () => new URLSearchParams('date=2026-09-25'),
}));

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

const award = (
    memberId: string,
    rank: MedalAward['rank'],
    category: MedalAward['category']
): MedalAward => ({
    memberId,
    rank,
    category,
    categoryLabel: category,
    medal: rank === 'gold' ? '🥇' : rank === 'silver' ? '🥈' : '🥉',
    value: 1,
});

const weekAwards: MedalAward[] = [
    award('m1', 'gold', 'workouts'),
    award('m1', 'silver', 'totalSteps'),
    award('m2', 'gold', 'daysLogged'),
    award('m2', 'bronze', 'avgWaterMl'),
];

const boards: MedalBoard[] = [
    { period: 'day', label: 'Today', awards: weekAwards },
    { period: 'week', label: 'This week', awards: weekAwards },
    { period: 'month', label: 'This month', awards: [] },
];

describe('MedalLeaderboard', () => {
    beforeEach(() => push.mockClear());

    it('shows one member per row ordered by 5/3/1 medal points', () => {
        render(
            <MedalLeaderboard
                members={members}
                boards={boards}
                medalDate="2026-09-27"
                today="2026-09-27"
            />
        );

        const rows = screen.getAllByRole('listitem');
        expect(rows).toHaveLength(3);
        expect(within(rows[0]).getByText('Dillon')).toBeInTheDocument();
        expect(within(rows[0]).getByText('8 pts')).toBeInTheDocument();
        expect(within(rows[1]).getByText('Angel')).toBeInTheDocument();
        expect(within(rows[1]).getByText('6 pts')).toBeInTheDocument();
        expect(within(rows[2]).getByText('Bradley')).toBeInTheDocument();
        expect(within(rows[2]).getByText('0 pts')).toBeInTheDocument();
        expect(screen.getByText(/winner, baby!/)).toHaveTextContent(
            "Dillon is leading today — you're a winner, baby!"
        );
        expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Week' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Month' })).toBeInTheDocument();
        expect(screen.getByLabelText('Choose medal date')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-medal-rank="gold"]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-medal-rank="silver"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-medal-rank="bronze"]')).toHaveLength(1);
    });

    it('shows daily medals on the profile medal shelf', () => {
        render(
            <MemberMedals
                memberId="m1"
                boards={boards}
                medalDate="2026-09-27"
                today="2026-09-27"
            />
        );

        expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel', { name: 'Today' })).toHaveTextContent('workouts');
        expect(screen.getByRole('tabpanel', { name: 'Today' })).toHaveTextContent('totalSteps');
        expect(screen.getByLabelText('Choose medal date')).toBeInTheDocument();
    });

    it('preserves other query values when choosing a medal date', () => {
        render(
            <MedalLeaderboard
                members={members}
                boards={boards}
                medalDate="2026-09-27"
                today="2026-09-27"
            />
        );

        fireEvent.change(screen.getByLabelText('Choose medal date'), {
            target: { value: '2026-09-20' },
        });

        expect(push).toHaveBeenCalledWith('/?date=2026-09-25&medalDate=2026-09-20', {
            scroll: false,
        });
    });

    it('shows a selected date while keeping the period labels unchanged', () => {
        render(
            <MedalLeaderboard
                members={members}
                boards={[{ ...boards[0], label: '20 Sept 2026' }, ...boards.slice(1)]}
                medalDate="2026-09-20"
                today="2026-09-27"
            />
        );

        expect(screen.getByText('20 Sept')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByLabelText('Choose medal date').parentElement?.className).toContain(
            'dateActive'
        );
    });

    it('clears the selected date when choosing a preset period', () => {
        render(
            <MedalLeaderboard
                members={members}
                boards={[{ ...boards[0], label: '20 Sept 2026' }, ...boards.slice(1)]}
                medalDate="2026-09-20"
                today="2026-09-27"
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Week' }));

        expect(push).toHaveBeenCalledWith('/?date=2026-09-25', { scroll: false });
    });
});