import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MedalAward } from '@/lib/aggregate';
import type { MedalBoard } from '@/lib/medals';
import type { Member } from '@/types/fitness';
import { MedalLeaderboard } from './MedalLeaderboard';

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
    { period: 'week', label: 'This week', awards: weekAwards },
    { period: 'month', label: 'This month', awards: [] },
];

describe('MedalLeaderboard', () => {
    it('shows one member per row ordered by 5/3/1 medal points', () => {
        render(<MedalLeaderboard members={members} boards={boards} />);

        const rows = screen.getAllByRole('listitem');
        expect(rows).toHaveLength(3);
        expect(within(rows[0]).getByText('Dillon')).toBeInTheDocument();
        expect(within(rows[0]).getByText('8 pts')).toBeInTheDocument();
        expect(within(rows[1]).getByText('Angel')).toBeInTheDocument();
        expect(within(rows[1]).getByText('6 pts')).toBeInTheDocument();
        expect(within(rows[2]).getByText('Bradley')).toBeInTheDocument();
        expect(within(rows[2]).getByText('0 pts')).toBeInTheDocument();
        expect(screen.getByText(/Great work,/)).toHaveTextContent(
            'Great work, Dillon — leading this week with 8 points.'
        );
        expect(document.querySelectorAll('[data-medal-rank="gold"]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-medal-rank="silver"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-medal-rank="bronze"]')).toHaveLength(1);
    });
});