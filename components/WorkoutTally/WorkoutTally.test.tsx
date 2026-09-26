import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Member } from '@/types/fitness';
import { WorkoutTally } from './WorkoutTally';

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

describe('WorkoutTally', () => {
    it('shows today, weekly target progress, month count and period labels for every member', () => {
        render(
            <WorkoutTally
                members={members}
                tallies={{
                    m1: { today: 1, week: 3, month: 8 },
                    m2: { today: 0, week: 4, month: 10 },
                }}
                weekLabel="Mon 21 – Sun 27 Sept"
                monthLabel="September 2026"
            />
        );

        const list = screen.getByRole('list', { name: 'Workout counts per person' });
        const cards = within(list).getAllByRole('listitem');
        expect(cards).toHaveLength(2);
        expect(cards[0]).toHaveTextContent('1 today');
        expect(cards[0]).toHaveTextContent('1 to target');
        expect(cards[0]).toHaveTextContent('8 workouts');
        expect(cards[0]).toHaveTextContent('Mon 21 – Sun 27 Sept');
        expect(cards[1]).toHaveTextContent('Target met');
        expect(cards[1]).toHaveTextContent('September 2026');
        expect(within(cards[0]).getByRole('img')).toHaveAccessibleName(
            '3 of 4 recommended workouts this week'
        );
    });
});