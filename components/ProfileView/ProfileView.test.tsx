import { STEP_CALORIES_PREFERENCE_KEY } from '@hooks/useStepCaloriesPreference';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { saveProfileInfo, saveProfileTargets } from '@/app/actions';
import type { Member, MemberProfile } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
  saveProfileInfo: vi.fn(async () => ({ ok: true })),
  saveProfileTargets: vi.fn(async () => ({ ok: true })),
  saveProfileAccent: vi.fn(async () => ({ ok: true })),
  saveWeightMeasurement: vi.fn(async () => ({ ok: true })),
  saveAvatar: vi.fn(async () => ({ ok: true })),
  addMember: vi.fn(async () => ({ ok: false })),
  removeMember: vi.fn(async () => ({ ok: false })),
}));
vi.mock('@/app/auth-actions', () => ({
  lock: vi.fn(async () => undefined),
  saveAccountSettings: vi.fn(async () => ({ ok: true })),
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
  it('anchors weight logging at the progress section so its headings are included', () => {
    render(
      <ProfileView
        members={[member]}
        member={member}
        profile={profile}
        measurements={[]}
        currentDate="2026-09-27"
      />
    );

    const progressSection = screen.getByRole('region', { name: 'Weight progress' });
    expect(progressSection).toHaveAttribute('id', 'log-weight');
    expect(within(progressSection).getByText('Progress')).toBeInTheDocument();
    expect(within(progressSection).getByRole('heading', { name: 'Weight progress' })).toBeInTheDocument();
    expect(within(progressSection).getByLabelText('Date')).toBeInTheDocument();
    expect(document.querySelectorAll('#log-weight')).toHaveLength(1);
  });

  it('switches and persists the selected appearance', async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;

    render(
      <ProfileView
        members={[member]}
        member={member}
        profile={profile}
        measurements={[]}
        currentDate="2026-09-27"
      />
    );

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('fitnessjourni-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');

    delete document.documentElement.dataset.theme;
    window.localStorage.clear();
  });

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
    expect(screen.getByRole('button', { name: '3 months' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
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
    expect(
      screen.getByRole('group', { name: 'Goals and targets' }).closest('form')
    ).toHaveFormValues({
      targetSleepHours: 8,
      targetCalories: 2500,
      targetProtein: '156',
      targetCarbs: '313',
      targetFat: '69',
    });
    await user.click(screen.getByRole('button', { name: 'Choose profile colour' }));
    expect(screen.getByRole('radio', { name: 'blue' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'orange — already assigned' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'aqua' }));

    expect(screen.getByRole('radio', { name: 'aqua' })).toBeChecked();
    expect(screen.getByRole('group', { name: 'Profile colour' }).closest('form')).toHaveFormValues({
      accent: 'aqua',
    });
    expect(screen.getByRole('button', { name: 'Save colour' })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Personal info' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Measurements' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Goals and targets' })).toBeInTheDocument();
  });

  it('saves profile information and targets from separate forms', async () => {
    const user = userEvent.setup();
    vi.mocked(saveProfileInfo).mockClear();
    vi.mocked(saveProfileTargets).mockClear();
    render(
      <ProfileView
        members={[member]}
        member={member}
        profile={profile}
        measurements={[]}
        currentDate="2026-09-27"
      />
    );

    const infoForm = screen.getByRole('button', { name: 'Save info' }).closest('form');
    const targetsForm = screen.getByRole('button', { name: 'Save targets' }).closest('form');
    expect(infoForm).not.toBe(targetsForm);
    expect(infoForm).toHaveFormValues({ name: 'Dillon', heightCm: 180 });
    expect(infoForm).not.toHaveFormValues({ targetWeightKg: 75, targetCalories: 2500 });
    expect(targetsForm).toHaveFormValues({ targetWeightKg: 75, targetCalories: 2500 });
    expect(targetsForm).not.toHaveFormValues({ name: 'Dillon', heightCm: 180 });

    await user.click(screen.getByRole('button', { name: 'Save info' }));
    await waitFor(() => expect(saveProfileInfo).toHaveBeenCalledOnce());
    const infoData = vi.mocked(saveProfileInfo).mock.calls[0]?.[1];
    expect(infoData?.get('memberId')).toBe('m1');
    expect(infoData?.get('heightCm')).toBe('180');
    expect(infoData?.has('targetCalories')).toBe(false);
    expect(saveProfileTargets).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save targets' }));
    await waitFor(() => expect(saveProfileTargets).toHaveBeenCalledOnce());
    const targetsData = vi.mocked(saveProfileTargets).mock.calls[0]?.[1];
    expect(targetsData?.get('memberId')).toBe('m1');
    expect(targetsData?.get('targetCalories')).toBe('2500');
    expect(targetsData?.has('name')).toBe(false);
    expect(targetsData?.has('heightCm')).toBe(false);
  });

  it('saves the burned-kcal preference immediately from Goals and targets', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem(STEP_CALORIES_PREFERENCE_KEY);
    vi.mocked(saveProfileTargets).mockClear();
    render(
      <ProfileView
        members={[member]}
        member={member}
        profile={profile}
        measurements={[]}
        currentDate="2026-09-27"
      />
    );

    const preference = screen.getByRole('checkbox', {
      name: 'Count burned kcal towards target',
    });
    expect(preference).not.toBeChecked();

    await user.click(preference);

    expect(preference).toBeChecked();
    expect(window.localStorage.getItem(STEP_CALORIES_PREFERENCE_KEY)).toBe('true');
    expect(saveProfileTargets).not.toHaveBeenCalled();

    await user.click(preference);

    expect(preference).not.toBeChecked();
    expect(window.localStorage.getItem(STEP_CALORIES_PREFERENCE_KEY)).toBe('false');
    window.localStorage.removeItem(STEP_CALORIES_PREFERENCE_KEY);
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
    expect(
      screen.getByRole('img', { name: /3 Sept 2026.*20 Sept 2026/ }).querySelectorAll('circle')
    ).toHaveLength(2);

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
    expect(
      screen.getByRole('group', { name: 'Goals and targets' }).closest('form')
    ).toHaveFormValues({
      targetProtein: '144',
      targetCarbs: '288',
      targetFat: '64',
    });
  });

  it('shows immutable username and gates password fields behind a control', async () => {
    const user = userEvent.setup();
    render(
      <ProfileView
        members={[member]}
        member={member}
        profile={profile}
        account={{ memberId: 'm1', username: 'dillon', email: 'dillon@example.com' }}
        measurements={[]}
        currentDate="2026-09-27"
      />
    );

    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByLabelText('Username')).toHaveValue('dillon');
    expect(screen.getByLabelText('Email')).toHaveValue('dillon@example.com');
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change password…' }));

    expect(screen.getByLabelText('Current password')).toBeRequired();
    expect(screen.getByLabelText('New password')).toBeRequired();
    expect(screen.queryByRole('button', { name: 'Who are you?' })).not.toBeInTheDocument();
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

describe('the identity panels', () => {
  const renderProfile = () =>
    render(
      <ProfileView
        members={[member, otherMember]}
        member={member}
        profile={profile}
        measurements={[]}
        currentDate="2026-09-27"
      />
    );

  it('start closed, so Profile opens on the numbers', () => {
    renderProfile();

    for (const name of ['Choose profile picture', 'Choose profile colour', 'Show achievements']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false');
    }
    expect(screen.queryByRole('group', { name: 'Profile colour' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'blue' })).not.toBeInTheDocument();
  });

  it('offers six controls: three panels, one page, two jumps', () => {
    renderProfile();

    for (const name of ['Choose profile picture', 'Choose profile colour', 'Show achievements']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Manage groups' })).toHaveAttribute('href', '/groups');
    expect(screen.getByRole('link', { name: 'Goals and targets' })).toHaveAttribute(
      'href',
      '#goals-and-targets'
    );
    expect(screen.getByRole('link', { name: 'Account settings' })).toHaveAttribute(
      'href',
      '#account-settings'
    );
  });

  it('points the jumps at sections that are really there', () => {
    renderProfile();

    // A dead anchor scrolls nowhere and says nothing, so the targets are asserted.
    expect(document.getElementById('goals-and-targets')).not.toBeNull();
    expect(document.getElementById('account-settings')).not.toBeNull();
  });

  it('opens only one at a time', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Choose profile colour' }));
    expect(screen.getByRole('group', { name: 'Profile colour' })).toBeInTheDocument();

    // Opening another closes the first rather than stacking them.
    await user.click(screen.getByRole('button', { name: 'Choose profile picture' }));
    expect(screen.queryByRole('group', { name: 'Profile colour' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose profile colour' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Choose profile picture' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('closes the open one when its own button is pressed again', async () => {
    const user = userEvent.setup();
    renderProfile();

    const colour = screen.getByRole('button', { name: 'Choose profile colour' });
    await user.click(colour);
    expect(colour).toHaveAttribute('aria-expanded', 'true');

    await user.click(colour);
    expect(colour).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Profile colour' })).not.toBeInTheDocument();
  });

  it('shows achievements only once asked', async () => {
    const user = userEvent.setup();
    renderProfile();

    expect(document.getElementById('achievements')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show achievements' }));

    expect(document.getElementById('achievements')).not.toBeNull();
  });

  it('names the current group and links it to group management', () => {
    render(
      <ProfileView
        members={[member]}
        member={member}
        profile={profile}
        measurements={[]}
        currentDate="2026-09-27"
        activeGroupName="Nine Elms"
      />
    );

    const link = screen.getByRole('link', { name: /Group Nine Elms/ });
    expect(link).toHaveAttribute('href', '/groups');
  });

  it('says so plainly when there is no group', () => {
    renderProfile();

    expect(screen.getByText('Personal (no group)')).toBeInTheDocument();
  });

  it('lets each panel close itself', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Choose profile colour' }));
    await user.click(screen.getByRole('button', { name: 'Close profile colour chooser' }));
    expect(screen.queryByRole('group', { name: 'Profile colour' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show achievements' }));
    await user.click(screen.getByRole('button', { name: 'Close achievements' }));
    expect(document.getElementById('achievements')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Choose profile picture' }));
    await user.click(screen.getByRole('button', { name: 'Close profile picture chooser' }));
    expect(document.getElementById('avatar-picker')).toBeNull();
  });

  it('lets the picture itself be replaced without opening the chooser', () => {
    renderProfile();

    const field = screen.getByLabelText('Change your profile picture');
    expect(field).toHaveAttribute('type', 'file');
    expect(field).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');

    // A label pointing at it, so tapping the photo opens the dialog with no
    // script of ours, and the field stays keyboard reachable.
    const label = document.querySelector(`label[for="${field.id}"]`);
    expect(label).toBeInTheDocument();
  });

  it('uploads as soon as a file is chosen', async () => {
    const user = userEvent.setup();
    renderProfile();

    const field = screen.getByLabelText('Change your profile picture') as HTMLInputElement;
    const submit = vi.fn();
    // requestSubmit is what the change handler calls; jsdom does not implement it.
    (field.form as HTMLFormElement).requestSubmit = submit;

    await user.upload(field, new File(['x'], 'me.png', { type: 'image/png' }));

    // The handler shrinks the file first, so the submit lands a microtask later.
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });

  it('still offers the chooser, for the preset avatars and a deliberate save', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Choose profile picture' }));

    expect(screen.getByRole('button', { name: 'Save picture' })).toBeInTheDocument();
  });
});
