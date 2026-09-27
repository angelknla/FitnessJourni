import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { awardMedals, type LogSummary } from '@/lib/aggregate';
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

const workoutCounts = { m1: 3 };
const medals = awardMedals(
    summaries,
    workoutCounts,
    Object.fromEntries(members.map((member) => [member.id, member.targets]))
);

describe('LogsTable', () => {
    it('shows one accessible column chart per person with every period metric', () => {
        render(
            <LogsTable
                members={members}
                summaries={summaries}
                workoutCounts={workoutCounts}
                medals={medals}
                showAverages
            />
        );

        expect(screen.getByRole('list', { name: 'Progress charts by person' })).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByRole('img', { name: /Dillon progress:.*Workouts 3.*Steps 50,000/ }))
            .toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Angel progress:.*Workouts 0.*Steps 36,000/ }))
            .toBeInTheDocument();
        expect(screen.queryByText('Protein/day')).not.toBeInTheDocument();
        expect(screen.queryByText('kcal/day')).not.toBeInTheDocument();
        expect(screen.getAllByText('Nutrition')).toHaveLength(2);
        expect(screen.getByRole('img', { name: /Dillon progress:.*Nutrition 96%, gold medal/ }))
            .toBeInTheDocument();
        expect(screen.getByText('7.5 / 8 hours')).toBeInTheDocument();
        expect(screen.queryByText('★')).not.toBeInTheDocument();
        expect(document.querySelectorAll('[data-medal-rank="gold"]')).toHaveLength(7);
        expect(document.querySelectorAll('[data-medal-rank="silver"]')).toHaveLength(5);
    });

    it('shows daily sleep without calling it an average on the Today view', () => {
        render(
            <LogsTable
                members={members}
                summaries={summaries}
                workoutCounts={{ m1: 1 }}
                medals={awardMedals(
                    summaries,
                    { m1: 1 },
                    Object.fromEntries(members.map((member) => [member.id, member.targets]))
                )}
                showAverages={false}
            />
        );

        expect(screen.queryByText('Steps/day')).not.toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getAllByText('Water/day')).toHaveLength(2);
        expect(screen.queryByText('Protein/day')).not.toBeInTheDocument();
        expect(screen.queryByText('kcal/day')).not.toBeInTheDocument();
        expect(screen.getAllByText('Nutrition')).toHaveLength(2);
        expect(screen.getByText('7.5 / 8 hours')).toBeInTheDocument();
        expect(screen.getAllByText('Sleep')).toHaveLength(2);
        expect(screen.queryByText('Sleep/day')).not.toBeInTheDocument();
    });
});