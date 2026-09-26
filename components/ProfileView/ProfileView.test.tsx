import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Member, MemberProfile } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
    saveProfileDetails: vi.fn(async () => ({ ok: true })),
    saveProfileAccent: vi.fn(async () => ({ ok: true })),
    saveWeightMeasurement: vi.fn(async () => ({ ok: true })),
    saveAvatar: vi.fn(async () => ({ ok: true })),
    addMember: vi.fn(async () => ({ ok: false })),
    removeMember: vi.fn(async () => ({ ok: false })),
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

const otherMember: Member = {
    ...member,
    id: 'm2',
    name: 'Angel',
    accent: 'orange',
    sortOrder: 1,
};

const profile: MemberProfile = {
    memberId: 'm1',
    age: 34,
    heightCm: 180,
    targetWeightKg: 75,
    targetBmi: 23,
};

beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:avatar-preview');
    URL.revokeObjectURL = vi.fn();
    if (!HTMLDialogElement.prototype.showModal) {
        HTMLDialogElement.prototype.showModal = function showModal() {
            this.open = true;
        };
    }
    if (!HTMLDialogElement.prototype.close) {
        HTMLDialogElement.prototype.close = function close() {
            this.open = false;
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
        const chart = screen.getByRole('img', {
            name: /Monthly weight trend.*82.0 kilograms.*81.0 kilograms/,
        });
        expect(chart).toBeInTheDocument();
        expect(chart.querySelector('polyline')).toHaveAttribute('points');
    });

    it('offers editable measurements and goals', async () => {
        const user = userEvent.setup();
        render(
            <ProfileView
                members={[member, otherMember]}
                member={member}
                profile={profile}
                measurements={[{ month: '2026-09-01', weightKg: 81 }]}
                currentMonth="2026-09"
            />
        );

        expect(screen.getByLabelText('Age')).toHaveValue(34);
        expect(screen.getByLabelText('First name')).toHaveValue('Dillon');
        expect(screen.getByLabelText('Surname')).toHaveValue('');
        expect(screen.getByLabelText(/^Height/)).toHaveValue(180);
        const currentWeight = screen.getByLabelText('Current weight');
        const monthlyWeight = screen.getByLabelText(/^Weight/, { selector: '#profile-weight' });
        expect(currentWeight).toHaveValue(81);
        expect(currentWeight).not.toHaveAttribute('readonly');

        await user.clear(currentWeight);
        await user.type(currentWeight, '79.5');

        expect(monthlyWeight).toHaveValue(79.5);
        expect(currentWeight.closest('form')).toHaveFormValues({
            currentWeightKg: 79.5,
            currentMonth: '2026-09',
            saveCurrentWeight: 'true',
        });
        expect(screen.getByLabelText(/^Weight goal/)).toHaveValue(75);
        expect(screen.getByLabelText('BMI goal')).toHaveValue(23);
        expect(screen.getByRole('radio', { name: 'blue' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'orange — already assigned' })).toBeDisabled();

        await user.click(screen.getByRole('radio', { name: 'aqua' }));

        expect(screen.getByRole('radio', { name: 'aqua' })).toBeChecked();
        expect(screen.getByRole('group', { name: 'Profile colour' }).closest('form')).toHaveFormValues({ accent: 'aqua' });
        expect(screen.getByRole('button', { name: 'Save colour' })).toBeEnabled();
        expect(screen.getByRole('group', { name: 'Personal info' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Measurements' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Goals and targets' })).toBeInTheDocument();
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

        expect(screen.getByRole('dialog', { name: 'Who are you?', hidden: true })).toHaveAttribute(
            'open'
        );
        expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    });

    it('offers self-removal normally and the member picker to admins', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[]}
                currentMonth="2026-09"
            />
        );

        await user.click(screen.getByRole('button', { name: 'Remove my account' }));
        expect(
            screen.getByRole('dialog', { name: 'Remove your account', hidden: true })
        ).toHaveAttribute('open');

        rerender(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[]}
                currentMonth="2026-09"
                canRemoveOthers
            />
        );
        await user.click(screen.getByRole('button', { name: 'Remove someone' }));

        expect(screen.getByRole('dialog', { name: 'Remove someone', hidden: true })).toHaveAttribute(
            'open'
        );
    });

    it('offers presets, an initial, and an upload as the final avatar tile', async () => {
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

        await user.click(screen.getByRole('button', { name: 'Choose profile picture' }));

        expect(screen.getByRole('radio', { name: 'Initial' })).toBeChecked();
        expect(
            within(screen.getByRole('group', { name: 'Profile picture' })).getAllByRole('radio')
        ).toHaveLength(8);
        expect(screen.getByRole('radio', { name: 'Uploaded photo' })).not.toBeChecked();
        const upload = screen.getByLabelText('Upload photo', { selector: 'input[type="file"]' });
        expect(upload).toHaveAttribute('type', 'file');
        expect(upload).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
        expect(screen.getByRole('button', { name: 'Save picture' })).toBeInTheDocument();

        await user.click(screen.getByText('Upload photo'));
        expect(screen.getByRole('radio', { name: 'Uploaded photo' })).toBeChecked();
        expect(screen.getByRole('button', { name: 'Save picture' })).toBeDisabled();

        const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
        await user.upload(upload, file);
        expect(screen.getByRole('radio', { name: 'Uploaded photo' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Initial' })).not.toBeChecked();
        expect(screen.getByRole('button', { name: 'Save picture' })).toBeEnabled();

        await user.click(screen.getByRole('button', { name: 'Close profile picture chooser' }));
        expect(screen.queryByRole('group', { name: 'Profile picture' })).not.toBeInTheDocument();
    });
});