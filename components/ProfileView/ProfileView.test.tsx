import { fireEvent, render, screen, within } from '@testing-library/react';
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
    it('switches weight progress between month and year views', async () => {
        const user = userEvent.setup();
        render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[
                    { date: '2026-08-01', weightKg: 82 },
                    { date: '2026-09-01', weightKg: 81 },
                ]}
                currentDate="2026-09-27"
            />
        );

        expect(screen.getByRole('region', { name: 'Current measurements' })).toHaveTextContent('25.0');
        expect(screen.queryByText('1 Aug 26')).not.toBeInTheDocument();
        expect(screen.getByText('1 Sept 26')).toBeInTheDocument();
        expect(screen.getByText('Goal 75.0 kg')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');

        expect(screen.getByRole('button', { name: '6 months' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '3 months' }));

        expect(screen.getByText('1 Aug 26')).toBeInTheDocument();
        const chart = screen.getByRole('img', {
            name: /Monthly weight trend.*82.0 kilograms.*81.0 kilograms/,
        });
        expect(chart).toBeInTheDocument();
        expect(chart.querySelector('polyline')).toHaveAttribute('points');
        expect(screen.getByRole('button', { name: '3 months' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Year' })).toBeInTheDocument();
    });

    it('offers editable measurements and goals', async () => {
        const user = userEvent.setup();
        render(
            <ProfileView
                members={[member, otherMember]}
                member={member}
                profile={profile}
                measurements={[{ date: '2026-09-27', weightKg: 81 }]}
                currentDate="2026-09-27"
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
            currentDate: '2026-09-27',
            saveCurrentWeight: 'true',
        });
        expect(screen.getByLabelText(/^Weight goal/)).toHaveValue(75);
        expect(screen.getByLabelText('BMI goal')).toHaveValue(23);
        expect(screen.getByLabelText('Sleep target')).toHaveValue(8);
        expect(screen.getByLabelText('Calorie target')).toHaveValue(2500);
        expect(screen.getByLabelText('Protein target grams')).toHaveValue(156);
        expect(screen.getByLabelText('Carbs target grams')).toHaveValue(313);
        expect(screen.getByLabelText('Fat target grams')).toHaveValue(69);
        expect(screen.getByRole('group', { name: 'Goals and targets' }).closest('form'))
            .toHaveFormValues({
                targetSleepHours: 8,
                targetCalories: 2500,
                targetProtein: '156',
                targetCarbs: '313',
                targetFat: '69',
            });
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

    it('tracks separate weight measurements on specific dates in the same month', () => {
        render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[
                    { date: '2026-09-03', weightKg: 82 },
                    { date: '2026-09-20', weightKg: 80.5 },
                ]}
                currentDate="2026-09-27"
            />
        );

        const date = screen.getByLabelText('Date');
        const weight = screen.getByLabelText(/^Weight/, { selector: '#profile-weight' });
        expect(screen.getByRole('img', { name: /3 Sept 2026.*20 Sept 2026/ })
            .querySelectorAll('circle')).toHaveLength(2);

        fireEvent.change(date, { target: { value: '2026-09-03' } });

        expect(weight).toHaveValue(82);
        expect(date.closest('form')).toHaveFormValues({ date: '2026-09-03', weightKg: 82 });
        expect(screen.getByRole('button', { name: 'Save weight' })).toBeEnabled();
    });

    it('switches profile macro targets between grams and percentages', async () => {
        const user = userEvent.setup();
        render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[]}
                currentDate="2026-09-27"
            />
        );

        const calories = screen.getByLabelText('Calorie target');
        await user.clear(calories);
        await user.type(calories, '2300');
        await user.click(screen.getByRole('button', { name: 'Percent' }));

        expect(calories).toHaveValue(2300);
        expect(screen.getByLabelText('Protein target percentage')).toHaveValue(25);
        expect(screen.getByLabelText('Carbs target percentage')).toHaveValue(50);
        expect(screen.getByLabelText('Fat target percentage')).toHaveValue(25);
        expect(screen.getByText(/Split adds up to/)).toHaveTextContent('Split adds up to 100%.');
        expect(screen.getByRole('group', { name: 'Goals and targets' }).closest('form'))
            .toHaveFormValues({
                targetProtein: '144',
                targetCarbs: '288',
                targetFat: '64',
            });
    });

    it('opens identity switching from the account section', async () => {
        const user = userEvent.setup();
        render(
            <ProfileView
                members={[member]}
                member={member}
                profile={profile}
                measurements={[]}
                currentDate="2026-09-27"
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
                currentDate="2026-09-27"
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
                currentDate="2026-09-27"
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
                currentDate="2026-09-27"
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