import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Member, MemberProfile } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
    saveProfileDetails: vi.fn(async () => ({ ok: true })),
    saveWeightMeasurement: vi.fn(async () => ({ ok: true })),
    addMember: vi.fn(async () => ({ ok: false })),
}));
vi.mock('@/app/auth-actions', () => ({
    signInAs: vi.fn(async () => ({})),
    lock: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ProfileView } from './ProfileView';

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

const profile: MemberProfile = {
    memberId: 'm1',
    age: 34,
    heightCm: 180,
    targetWeightKg: 75,
    targetBmi: 23,
};

beforeAll(() => {
    if (!HTMLDialogElement.prototype.showModal) {
        HTMLDialogElement.prototype.showModal = function showModal() {
            this.open = true;
        };
    }
});

describe('ProfileView', () => {
    it('shows current BMI, goals and monthly tracking', () => {
        render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[
                    { month: '2026-08-01', weightKg: 82 },
                    { month: '2026-09-01', weightKg: 81 },
                ]}
                currentMonth="2026-09"
            />
        );

        expect(screen.getByRole('region', { name: 'Current measurements' })).toHaveTextContent('25.0');
        expect(screen.getByText('Aug 2026')).toBeInTheDocument();
        expect(screen.getByText('Sept 2026')).toBeInTheDocument();
        expect(screen.getByText('Goal 75.0 kg')).toBeInTheDocument();
    });

    it('offers editable measurements and goals', () => {
        render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[]}
                currentMonth="2026-09"
            />
        );

        expect(screen.getByLabelText('Age')).toHaveValue(34);
        expect(screen.getByLabelText(/^Height/)).toHaveValue(180);
        expect(screen.getByLabelText(/^Weight goal/)).toHaveValue(75);
        expect(screen.getByLabelText('BMI goal')).toHaveValue(23);
    });

    it('opens identity switching from the account section', async () => {
        const user = userEvent.setup();
        render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[]}
                currentMonth="2026-09"
            />
        );

        await user.click(screen.getByRole('button', { name: 'Who are you?' }));

        expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('open');
        expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    });
});