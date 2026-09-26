import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LogSummary, RankedMetric } from '@/lib/aggregate';
import type { Member } from '@/types/fitness';
import { LogsTable } from './LogsTable';

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

const summaries: Record<string, LogSummary> = {
    m1: {
        daysLogged: 5,
        totalSteps: 50000,
        avgSteps: 10000,
        avgWaterMl: 2500,
        avgCalories: 2400,
        avgProteinG: 150,
        sleepDaysLogged: 5,
        avgSleepHours: 7.5,
    },
    m2: {
        daysLogged: 4,
        totalSteps: 36000,
        avgSteps: 9000,
        avgWaterMl: 2200,
        avgCalories: 2100,
        avgProteinG: 130,
        sleepDaysLogged: 0,
        avgSleepHours: 0,
    },
};

const leaders: Record<RankedMetric, string[]> = {
    daysLogged: ['m1'],
    totalSteps: ['m1'],
    avgSteps: ['m1'],
    avgWaterMl: ['m1'],
    avgProteinG: ['m1'],
};

describe('LogsTable', () => {
    it('keeps every period metric and leader marker in visual profiles', () => {
        render(
            <LogsTable
                members={members}
                summaries={summaries}
                workoutCounts={{ m1: 3 }}
                leaders={leaders}
                showAverages
                caption="Averages are per day logged."
            />
        );

        const list = screen.getByRole('list', { name: 'Log summaries' });
        const profiles = within(list).getAllByRole('listitem');
        expect(profiles).toHaveLength(2);
        expect(profiles[0]).toHaveTextContent('5 days');
        expect(profiles[0]).toHaveTextContent('50,000');
        expect(profiles[0]).toHaveTextContent('10,000');
        expect(profiles[0]).toHaveTextContent('2.5 L');
        expect(profiles[0]).toHaveTextContent('150 g');
        expect(profiles[0]).toHaveTextContent('2,400');
        expect(profiles[0]).toHaveTextContent('7.5 h');
        expect(profiles[0]).toHaveTextContent('Workouts3');
        expect(profiles[1]).toHaveTextContent('Workouts0');
        expect(within(profiles[0]).getAllByText('★')).toHaveLength(5);
        expect(screen.getByText('Averages are per day logged.')).toBeInTheDocument();
    });

    it('shows daily sleep without calling it an average on the Today view', () => {
        render(
            <LogsTable
                members={members}
                summaries={summaries}
                workoutCounts={{ m1: 1 }}
                leaders={leaders}
                showAverages={false}
                caption="Today"
            />
        );

        expect(screen.queryByText('Steps/day')).not.toBeInTheDocument();
        expect(screen.getAllByText('Water/day')).toHaveLength(2);
        expect(screen.getAllByText('Protein/day')).toHaveLength(2);
        expect(screen.getAllByText('kcal/day')).toHaveLength(2);
        expect(screen.getAllByText('Sleep')).toHaveLength(2);
        expect(screen.queryByText('Sleep/day')).not.toBeInTheDocument();
    });
});