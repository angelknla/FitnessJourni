'use client';

import { CrossIcon, GroupIcon, PencilIcon, SwitchIcon, UploadIcon } from '@components/Icons/Icons';
import { MemberMedals } from '@components/MedalLeaderboard/MedalLeaderboard';
import Link from '@components/NavigationLink/NavigationLink';
import { RemoveMemberDialog } from '@components/RemoveMemberDialog/RemoveMemberDialog';
import { avatarOptions, avatarUploadTypes, isAvatarPath } from '@data/avatarData';
import { accentHex, accentNames, defaultTargets } from '@data/fitnessData';
import { useBackgroundSave } from '@hooks/useBackgroundSave';
import { useStepCaloriesPreference } from '@hooks/useStepCaloriesPreference';
import { replaceInputFile, shrinkImage } from '@utils/image';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useEffect, useRef, useState, useTransition } from 'react';
import {
  saveAvatar,
  saveProfileAccent,
  saveProfileInfo,
  saveProfileTargets,
  saveWeightMeasurement,
} from '@/app/actions';
import { lock, saveAccountSettings } from '@/app/auth-actions';
import type { MemberAccount } from '@/lib/data/accounts';
import { calculateBmi } from '@/lib/data/profile';
import {
  gramsFromPercents,
  kcalFromGrams,
  type MacroGrams,
  type MacroKey,
  type MacroPercents,
  macroKeys,
  percentsFromGrams,
  percentTotal,
} from '@/lib/macros';
import type { MedalBoard } from '@/lib/medals';
import ui from '@/styles/ui.module.css';
import type { Member, MemberProfile, WeightMeasurement } from '@/types/fitness';

import styles from './ProfileView.module.css';
import { useProfileUpdates } from './useProfileUpdates';

interface ProfileViewProps {
  members: Member[];
  member: Member | null;
  profile: MemberProfile | null;
  account?: MemberAccount | null;
  measurements: WeightMeasurement[];
  currentDate: string;
  medalDate?: string;
  medalBoards?: MedalBoard[];
  canRemoveOthers?: boolean;
  /** The current group's name, or null in Personal mode. */
  activeGroupName?: string | null;
}

const dateLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const chartDateLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
});
const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_LEFT = 44;
const CHART_RIGHT = 14;
const CHART_TOP = 14;
const CHART_BOTTOM = 36;
/** Which of the identity panels is showing; null for none. */
type IdentityPanel = 'avatar' | 'accent' | 'medals' | null;
type ProfileMacroMode = 'grams' | 'percent';
type WeightChartRange = 'month' | 'threeMonths' | 'sixMonths' | 'year';
type ProfileMacroDraft = Record<MacroKey, string>;
type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'fitnessjourni-theme';

const weightChartRanges: { value: WeightChartRange; label: string; months: number }[] = [
  { value: 'month', label: 'Month', months: 1 },
  { value: 'threeMonths', label: '3 months', months: 3 },
  { value: 'sixMonths', label: '6 months', months: 6 },
  { value: 'year', label: 'Year', months: 12 },
];

const weightRangeStart = (currentDate: string, months: number) => {
  const start = new Date(`${currentDate}T00:00:00Z`);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  return start.toISOString().slice(0, 10);
};

const toMacroDraft = (values: MacroGrams | MacroPercents): ProfileMacroDraft => ({
  protein: String(values.protein),
  carbs: String(values.carbs),
  fat: String(values.fat),
});

const toPositiveNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const macroDraftNumbers = (draft: ProfileMacroDraft): MacroGrams => ({
  protein: toPositiveNumber(draft.protein),
  carbs: toPositiveNumber(draft.carbs),
  fat: toPositiveNumber(draft.fat),
});

const macroLabels: Record<MacroKey, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

export const ProfileView = ({
  members,
  member: serverMember,
  profile: serverProfile,
  account: serverAccount = null,
  measurements: serverMeasurements,
  currentDate,
  medalDate = currentDate,
  medalBoards = [],
  canRemoveOthers = false,
  activeGroupName = null,
}: ProfileViewProps) => {
  const updates = useProfileUpdates(
    {
      member: serverMember,
      profile: serverProfile,
      account: serverAccount,
      measurements: serverMeasurements,
    },
    `${serverMember?.id}:${currentDate}`
  );
  const { member, profile, account, measurements } = updates.data;
  const router = useRouter();
  const [removeOpen, setRemoveOpen] = useState(false);
  /*
   * The identity buttons reveal one panel at a time. A single value rather than
   * three booleans, because "only one open" is then the type's doing instead of
   * something three separate setters have to remember.
   */
  const [openPanel, setOpenPanel] = useState<IdentityPanel>(null);
  const togglePanel = (panel: Exclude<IdentityPanel, null>) =>
    setOpenPanel((open) => (open === panel ? null : panel));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState(
    member?.avatarPath && !isAvatarPath(member.avatarPath) ? 'upload' : (member?.avatarPath ?? '')
  );
  const [selectedAccent, setSelectedAccent] = useState(member?.accent ?? 'blue');
  const savedAvatarFile = useRef<File | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [signingOut, startSignOut] = useTransition();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState('');
  const [newPasswordDraft, setNewPasswordDraft] = useState('');
  const optionalNumber = (data: FormData, field: string) =>
    String(data.get(field) ?? '').trim() ? Number(data.get(field)) : null;
  const infoSave = useBackgroundSave(
    (data) =>
      updates.save({
        key: 'info',
        label: 'Personal information',
        data,
        change: {
          member: {
            name: String(data.get('name') ?? '').trim(),
            firstName: String(data.get('name') ?? '').trim(),
            surname: String(data.get('surname') ?? '').trim() || null,
          },
          profile: { age: optionalNumber(data, 'age'), heightCm: optionalNumber(data, 'heightCm') },
          ...(data.get('saveCurrentWeight') === 'true' &&
          optionalNumber(data, 'currentWeightKg') !== null
            ? {
                measurement: {
                  date: String(data.get('currentDate')),
                  weightKg: Math.round(Number(data.get('currentWeightKg')) * 100) / 100,
                },
              }
            : {}),
        },
        save: (form) => saveProfileInfo({ ok: false }, form),
      }),
    () => {},
    () => {}
  );
  const targetsSave = useBackgroundSave(
    (data) =>
      updates.save({
        key: 'targets',
        label: 'Goals and targets',
        data,
        change: {
          profile: {
            targetWeightKg: optionalNumber(data, 'targetWeightKg'),
            targetBmi: optionalNumber(data, 'targetBmi'),
          },
          member: {
            targets: {
              ...member!.targets,
              sleepHours: Number(data.get('targetSleepHours')),
              calories: Number(data.get('targetCalories')),
              protein: Number(data.get('targetProtein')),
              carbs: Number(data.get('targetCarbs')),
              fat: Number(data.get('targetFat')),
            },
          },
        },
        save: (form) => saveProfileTargets({ ok: false }, form),
      }),
    () => {},
    () => {}
  );
  const weightSave = useBackgroundSave(
    (data) =>
      updates.save({
        key: 'weight',
        label: 'Weight',
        data,
        change: {
          measurement: {
            date: String(data.get('date')),
            weightKg: Math.round(Number(data.get('weightKg')) * 100) / 100,
          },
        },
        save: (form) => saveWeightMeasurement({ ok: false }, form),
      }),
    () => {},
    () => {}
  );
  const avatarSave = useBackgroundSave(
    (data) => {
      let file = data.get('avatarFile');
      if (file instanceof File && file.size > 0) savedAvatarFile.current = file;
      else if (selectedAvatar === 'upload' && avatarPreview && savedAvatarFile.current) {
        file = savedAvatarFile.current;
        data.set('avatarFile', file);
      }
      return updates.save({
        key: 'avatar',
        label: 'Profile picture',
        data,
        change: {
          member: {
            avatarPath:
              file instanceof File && file.size > 0
                ? updates.preview(file)
                : String(data.get('avatarPath') ?? '') || null,
          },
        },
        save: (form) => saveAvatar({ ok: false }, form),
      });
    },
    () => setOpenPanel(null),
    () => setOpenPanel('avatar')
  );
  const accentSave = useBackgroundSave(
    (data) =>
      updates.save({
        key: 'accent',
        label: 'Profile colour',
        data,
        change: { member: { accent: String(data.get('accent')) as Member['accent'] } },
        save: (form) => saveProfileAccent({ ok: false }, form),
      }),
    () => setOpenPanel(null),
    () => setOpenPanel('accent')
  );
  const accountSave = useBackgroundSave(
    (data) =>
      updates.save({
        key: 'account',
        label: 'Account settings',
        data,
        change: { email: String(data.get('email')).trim().toLowerCase() },
        save: async (form) => {
          const result = await saveAccountSettings({}, form);
          return { ...result, ok: result.ok === true };
        },
      }),
    () => setPasswordOpen(false),
    () => {
      if (newPasswordDraft) setPasswordOpen(true);
    }
  );
  const { state: infoState, submit: infoAction, pending: infoPending } = infoSave;
  const { state: targetsState, submit: targetsAction, pending: targetsPending } = targetsSave;
  const { state: weightState, submit: weightAction, pending: weightPending } = weightSave;
  const { state: avatarState, submit: avatarAction, pending: avatarPending } = avatarSave;
  const { state: accentState, submit: accentAction, pending: accentPending } = accentSave;
  const { state: accountState, submit: accountAction, pending: accountPending } = accountSave;
  const [theme, setTheme] = useState<Theme>('light');
  const [includeStepCalories, setIncludeStepCalories] = useStepCaloriesPreference();

  const currentWeight = measurements.at(-1)?.weightKg ?? null;
  const currentDateMeasurement = measurements.find((item) => item.date === currentDate);
  const [weightDate, setWeightDate] = useState(currentDate);
  const [currentWeightDraft, setCurrentWeightDraft] = useState(
    String(currentDateMeasurement?.weightKg ?? currentWeight ?? '')
  );
  const [monthlyWeightDraft, setMonthlyWeightDraft] = useState(
    String(currentDateMeasurement?.weightKg ?? currentWeight ?? '')
  );
  const [currentWeightChanged, setCurrentWeightChanged] = useState(false);
  const [weightChartRange, setWeightChartRange] = useState<WeightChartRange>('month');
  const startingTargetGrams: MacroGrams = {
    protein: member?.targets.protein ?? 0,
    carbs: member?.targets.carbs ?? 0,
    fat: member?.targets.fat ?? 0,
  };
  const [targetMacroMode, setTargetMacroMode] = useState<ProfileMacroMode>('grams');
  const [targetCaloriesDraft, setTargetCaloriesDraft] = useState(
    String(member?.targets.calories ?? '')
  );
  const [targetGramDraft, setTargetGramDraft] = useState<ProfileMacroDraft>(
    toMacroDraft(startingTargetGrams)
  );
  const [targetPercentDraft, setTargetPercentDraft] = useState<ProfileMacroDraft>(
    toMacroDraft(percentsFromGrams(startingTargetGrams))
  );

  const draftScope = useRef<string | null>(null);
  useEffect(() => {
    const nextScope = `${serverMember?.id}:${currentDate}`;
    if (!serverMember?.id || draftScope.current === nextScope) return;
    draftScope.current = nextScope;
    const nextWeight = String(
      serverMeasurements.find((item) => item.date === currentDate)?.weightKg ??
        serverMeasurements.at(-1)?.weightKg ??
        ''
    );
    setWeightDate(currentDate);
    setCurrentWeightDraft(nextWeight);
    setMonthlyWeightDraft(nextWeight);
    setCurrentWeightChanged(false);
    setSelectedAccent(serverMember.accent);
    setSelectedAvatar(
      serverMember.avatarPath && !isAvatarPath(serverMember.avatarPath)
        ? 'upload'
        : (serverMember.avatarPath ?? '')
    );
    const nextGrams = {
      protein: serverMember.targets.protein,
      carbs: serverMember.targets.carbs,
      fat: serverMember.targets.fat,
    };
    setTargetMacroMode('grams');
    setTargetCaloriesDraft(String(serverMember.targets.calories));
    setTargetGramDraft(toMacroDraft(nextGrams));
    setTargetPercentDraft(toMacroDraft(percentsFromGrams(nextGrams)));
    setOpenPanel(null);
    setAvatarPreview(null);
    setCurrentPasswordDraft('');
    setNewPasswordDraft('');
  }, [currentDate, serverMember, serverMeasurements]);

  useEffect(() => {
    if (accountState.ok) {
      setCurrentPasswordDraft('');
      setNewPasswordDraft('');
    }
  }, [accountState.ok]);

  useEffect(() => {
    const activeTheme = document.documentElement.dataset.theme;
    if (activeTheme === 'light' || activeTheme === 'dark') {
      setTheme(activeTheme);
    }
  }, []);

  useEffect(
    () => () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    },
    [avatarPreview]
  );

  const currentBmi = calculateBmi(currentWeight, profile?.heightCm ?? null);
  const chartRangeMonths =
    weightChartRanges.find((range) => range.value === weightChartRange)?.months ?? 1;
  const chartStartDate = weightRangeStart(currentDate, chartRangeMonths);
  const chartMeasurements = measurements.filter(
    (measurement) => measurement.date >= chartStartDate && measurement.date <= currentDate
  );
  const chartValues = [
    ...chartMeasurements.map((measurement) => measurement.weightKg),
    profile?.targetWeightKg,
  ].filter((value): value is number => value !== null && value !== undefined);
  const chartSpread =
    chartValues.length > 0 ? Math.max(...chartValues) - Math.min(...chartValues) : 0;
  const chartPadding = Math.max(chartSpread * 0.2, 1);
  const chartMin = chartValues.length > 0 ? Math.min(...chartValues) - chartPadding : 0;
  const chartMax = chartValues.length > 0 ? Math.max(...chartValues) + chartPadding : 1;
  const chartRange = chartMax - chartMin;
  const chartPlotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const chartPlotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const chartPeriodStart = new Date(`${chartStartDate}T12:00:00`).getTime();
  const chartPeriodEnd = new Date(`${currentDate}T12:00:00`).getTime();
  const chartPeriodDuration = Math.max(chartPeriodEnd - chartPeriodStart, 1);
  const chartX = (date: string) =>
    CHART_LEFT +
    ((new Date(`${date}T12:00:00`).getTime() - chartPeriodStart) / chartPeriodDuration) *
      chartPlotWidth;
  const chartY = (weight: number) =>
    CHART_TOP + ((chartMax - weight) / chartRange) * chartPlotHeight;
  const chartPoints = chartMeasurements
    .map((measurement) => `${chartX(measurement.date)},${chartY(measurement.weightKg)}`)
    .join(' ');
  const chartTicks = [chartMax, (chartMax + chartMin) / 2, chartMin];
  const chartLabel = `Monthly weight trend. ${chartMeasurements
    .map(
      (measurement) =>
        `${dateLabel.format(new Date(`${measurement.date}T12:00:00`))}: ${measurement.weightKg.toFixed(1)} kilograms`
    )
    .join('; ')}`;

  const signOut = () =>
    startSignOut(async () => {
      await lock();
      router.push('/');
      router.refresh();
    });

  const selectTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}
  };

  if (!member || !profile) {
    return (
      <div className={styles.visitor}>
        <div className={styles.avatar}>?</div>
        <h2>Account unavailable</h2>
        <p>Log in again to view and update your profile.</p>
        <button type="button" className={styles.logout} onClick={signOut} disabled={signingOut}>
          {signingOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    );
  }

  const accent = accentHex[member.accent];
  const assignedAccents = new Set(
    members.filter((option) => option.id !== member.id).map((option) => option.accent)
  );
  const uploadedAvatar =
    member.avatarPath && !isAvatarPath(member.avatarPath) ? member.avatarPath : null;
  const chooseAvatar = (value: string) => {
    setSelectedAvatar(value);
    setAvatarPreview(null);
    savedAvatarFile.current = null;
    if (avatarFileRef.current) {
      avatarFileRef.current.value = '';
    }
  };
  const weightDifference =
    currentWeight !== null && profile.targetWeightKg !== null
      ? Math.abs(currentWeight - profile.targetWeightKg)
      : null;

  const changeCurrentWeight = (value: string) => {
    setCurrentWeightDraft(value);
    setCurrentWeightChanged(true);
    if (weightDate === currentDate) {
      setMonthlyWeightDraft(value);
    }
  };

  const changeWeightDate = (date: string) => {
    setWeightDate(date);
    const measurement = measurements.find((item) => item.date === date);
    setMonthlyWeightDraft(
      date === currentDate ? currentWeightDraft : String(measurement?.weightKg ?? '')
    );
  };

  const changeMonthlyWeight = (value: string) => {
    setMonthlyWeightDraft(value);
    if (weightDate === currentDate) {
      setCurrentWeightDraft(value);
      setCurrentWeightChanged(true);
    }
  };

  const targetCaloriesNumber = toPositiveNumber(targetCaloriesDraft);
  const targetGramNumbers = macroDraftNumbers(targetGramDraft);
  const targetPercentNumbers = macroDraftNumbers(targetPercentDraft);
  const effectiveTargetGrams =
    targetMacroMode === 'percent'
      ? gramsFromPercents(targetCaloriesNumber, targetPercentNumbers)
      : targetGramNumbers;
  const targetSplit = percentTotal(targetPercentNumbers);
  const targetSplitOff = targetMacroMode === 'percent' && targetSplit !== 100;

  const changeTargetCalories = (value: string) => {
    setTargetCaloriesDraft(value);
    if (targetMacroMode === 'grams') {
      setTargetGramDraft(
        toMacroDraft(gramsFromPercents(toPositiveNumber(value), targetPercentNumbers))
      );
    }
  };

  const changeTargetGram = (key: MacroKey, value: string) => {
    const next = { ...targetGramDraft, [key]: value };
    const nextNumbers = macroDraftNumbers(next);
    setTargetGramDraft(next);
    setTargetCaloriesDraft(String(kcalFromGrams(nextNumbers)));
    if (kcalFromGrams(nextNumbers) > 0) {
      setTargetPercentDraft(toMacroDraft(percentsFromGrams(nextNumbers)));
    }
  };

  const switchTargetMacroMode = (next: ProfileMacroMode) => {
    if (next === targetMacroMode) return;
    if (next === 'percent') {
      setTargetPercentDraft(toMacroDraft(percentsFromGrams(targetGramNumbers)));
    } else {
      setTargetGramDraft(
        toMacroDraft(gramsFromPercents(targetCaloriesNumber, targetPercentNumbers))
      );
    }
    setTargetMacroMode(next);
  };

  return (
    <div className={styles.profile} style={{ '--profile-accent': accent } as CSSProperties}>
      <section className={`${styles.identity} ${ui.card}`} aria-labelledby="profile-name">
        {/*
         * The picture is its own uploader: the label opens the file dialog and
         * choosing a file submits at once, so changing your photo does not mean
         * opening the chooser first. The chooser below still offers the preset
         * avatars and a deliberate Save.
         */}
        <form onSubmit={avatarAction} className={styles.avatarFrame}>
          <input type="hidden" name="memberId" value={member.id} />
          <input
            id="avatar-direct"
            className={styles.directInput}
            type="file"
            name="avatarFile"
            accept={avatarUploadTypes.join(',')}
            disabled={avatarPending}
            aria-label="Change your profile picture"
            onChange={async (event) => {
              const input = event.currentTarget;
              const chosen = input.files?.[0];
              if (!chosen) return;
              // Shrunk first, so the form posts the small version.
              replaceInputFile(input, await shrinkImage(chosen));
              input.form?.requestSubmit();
            }}
          />
          <label
            htmlFor="avatar-direct"
            className={styles.avatar}
            title="Change your profile picture"
          >
            {member.avatarPath ? (
              <Image
                src={member.avatarPath}
                alt=""
                /* Drawn at 88px; 3x wants ~264 device pixels. */
                width={264}
                height={264}
                unoptimized={
                  member.avatarPath.startsWith('http://') || member.avatarPath.startsWith('blob:')
                }
              />
            ) : (
              member.name.charAt(0).toUpperCase()
            )}
          </label>
          <span className={styles.editAvatar} aria-hidden="true">
            <PencilIcon size={12} />
          </span>
        </form>
        <div className={styles.identityDetails}>
          <div>
            <p>Your profile</p>
            <h2 id="profile-name">{[member.name, member.surname].filter(Boolean).join(' ')}</h2>
            {/*
             * Which group this account currently shares with. Managing
             * them is a page of its own — too much to sit inside Profile
             * — so this states the fact and is the way through to it.
             *
             * No aria-label: the group's name is the accessible name, so
             * "click the group name" and what a screen reader announces
             * stay the same thing.
             */}
            <Link href="/groups" className={styles.currentGroup} title="Manage groups">
              <GroupIcon size={13} />
              <span className={styles.currentGroupLabel}>Group</span>
              <span className={styles.currentGroupName}>
                {activeGroupName ?? 'Personal (no group)'}
              </span>
              <span className={styles.currentGroupChevron}>
                <SwitchIcon size={13} />
              </span>
            </Link>
          </div>
        </div>

        {/* Full width beneath both, so no control crowds the name. */}
        <div className={styles.identityActions}>
          <button
            type="button"
            className={styles.identityAction}
            onClick={() => togglePanel('avatar')}
            aria-expanded={openPanel === 'avatar'}
            aria-controls="avatar-picker"
          >
            Choose profile picture
          </button>
          <button
            type="button"
            className={styles.identityAction}
            onClick={() => togglePanel('accent')}
            aria-expanded={openPanel === 'accent'}
            aria-controls="accent-picker"
          >
            Choose profile colour
          </button>
          <button
            type="button"
            className={styles.identityAction}
            onClick={() => togglePanel('medals')}
            aria-expanded={openPanel === 'medals'}
            aria-controls="achievements"
          >
            Show achievements
          </button>
          <Link href="/groups" className={styles.identityAction}>
            Manage groups
          </Link>
          {/*
           * These two jump rather than reveal: both sections are long and stay on
           * the page, so a plain anchor is the honest control — it works without
           * JavaScript and the browser handles the smooth scroll.
           */}
          <a href="#goals-and-targets" className={styles.identityAction}>
            Goals and targets
          </a>
          <a href="#account-settings" className={styles.identityAction}>
            Account settings
          </a>
        </div>
      </section>

      {updates.statuses.length > 0 && (
        <div className={styles.saveStatus}>
          {updates.statuses.map(({ request, error }) => (
            <p key={request.key} role={error ? 'alert' : 'status'}>
              {error ? `${request.label} wasn’t saved. ${error}` : `${request.label} saving…`}
              {error && request.key !== 'account' && (
                <button
                  type="button"
                  onClick={() => {
                    void updates.save(request);
                  }}
                >
                  Retry
                </button>
              )}
            </p>
          ))}
        </div>
      )}

      {openPanel === 'avatar' && (
        <form id="avatar-picker" className={styles.avatarPicker} onSubmit={avatarAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <div className={styles.panelHead}>
            <h3>Profile picture</h3>
            <button
              type="button"
              className={styles.panelClose}
              aria-label="Close profile picture chooser"
              onClick={() => {
                setOpenPanel(null);
                setAvatarPreview(null);
              }}
            >
              <CrossIcon />
            </button>
          </div>
          <fieldset>
            <legend className="sr-only">Profile picture</legend>
            <div className={styles.avatarOptions}>
              <label className={styles.avatarOption}>
                <input
                  type="radio"
                  name="avatarPath"
                  value=""
                  checked={selectedAvatar === ''}
                  onChange={() => chooseAvatar('')}
                />
                <span className={styles.initialOption} aria-hidden="true">
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <span>Initial</span>
              </label>
              {avatarOptions.map((option) => (
                <label className={styles.avatarOption} key={option.path}>
                  <input
                    type="radio"
                    name="avatarPath"
                    value={option.path}
                    checked={selectedAvatar === option.path}
                    onChange={() => chooseAvatar(option.path)}
                  />
                  <Image src={option.path} alt="" width={46} height={46} />
                  <span>{option.label}</span>
                </label>
              ))}
              <div
                className={styles.avatarOption}
                data-selected={selectedAvatar === 'upload' || undefined}
              >
                <input
                  type="radio"
                  name="avatarPath"
                  value={uploadedAvatar ?? ''}
                  aria-label="Uploaded photo"
                  checked={selectedAvatar === 'upload'}
                  onChange={() => {
                    setSelectedAvatar('upload');
                    if (!uploadedAvatar && !avatarPreview) {
                      avatarFileRef.current?.click();
                    }
                  }}
                />
                <label htmlFor="avatar-upload" className={styles.uploadLabel}>
                  {avatarPreview || uploadedAvatar ? (
                    <Image
                      src={avatarPreview ?? uploadedAvatar ?? ''}
                      alt=""
                      width={46}
                      height={46}
                      unoptimized={Boolean(avatarPreview || uploadedAvatar?.startsWith('http://'))}
                    />
                  ) : (
                    <span className={styles.uploadOption} aria-hidden="true">
                      <UploadIcon />
                    </span>
                  )}
                  <span>Upload photo</span>
                </label>
                <input
                  ref={avatarFileRef}
                  id="avatar-upload"
                  className={styles.uploadInput}
                  type="file"
                  name="avatarFile"
                  accept={avatarUploadTypes.join(',')}
                  onClick={() => setSelectedAvatar('upload')}
                  onChange={async (event) => {
                    const input = event.currentTarget;
                    const chosen = input.files?.[0];
                    if (!chosen) {
                      setAvatarPreview(null);
                      return;
                    }
                    // The preview shows the file that will actually be uploaded.
                    const shrunk = await shrinkImage(chosen);
                    replaceInputFile(input, shrunk);
                    savedAvatarFile.current = shrunk;
                    setAvatarPreview(URL.createObjectURL(shrunk));
                    setSelectedAvatar('upload');
                  }}
                />
              </div>
            </div>
          </fieldset>
          <div className={styles.avatarActions}>
            <button
              type="submit"
              className={`${styles.saveButton} ${ui.primaryButton}`}
              disabled={
                avatarPending || (selectedAvatar === 'upload' && !avatarPreview && !uploadedAvatar)
              }
            >
              {avatarPending ? 'Saving…' : 'Save picture'}
            </button>
            {(avatarState.error || avatarState.message) && (
              <p className={avatarState.error ? styles.error : styles.success} role="status">
                {avatarState.error ?? avatarState.message}
              </p>
            )}
          </div>
        </form>
      )}

      {openPanel === 'accent' && (
        <form id="accent-picker" className={styles.accentPicker} onSubmit={accentAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <div className={styles.panelHead}>
            <h3>Profile colour</h3>
            <button
              type="button"
              className={styles.panelClose}
              aria-label="Close profile colour chooser"
              onClick={() => setOpenPanel(null)}
            >
              <CrossIcon />
            </button>
          </div>
          <fieldset>
            {/* The visible heading above is the same words, so this one is for
                assistive technology only — as in the picture chooser. */}
            <legend className="sr-only">Profile colour</legend>
            <div className={styles.accentOptions}>
              {accentNames.map((option) => {
                const assigned = assignedAccents.has(option);

                return (
                  <label className={styles.accentOption} key={option}>
                    <input
                      type="radio"
                      name="accent"
                      value={option}
                      checked={selectedAccent === option}
                      disabled={assigned}
                      aria-label={assigned ? `${option} — already assigned` : option}
                      onChange={() => setSelectedAccent(option)}
                    />
                    <span
                      style={{ '--accent-option': accentHex[option] } as CSSProperties}
                      aria-hidden="true"
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
          <button
            type="submit"
            className={`${styles.saveButton} ${ui.primaryButton}`}
            disabled={accentPending || selectedAccent === member.accent}
          >
            {accentPending ? 'Saving…' : 'Save colour'}
          </button>
          {(accentState.error || accentState.message) && (
            <p className={accentState.error ? styles.error : styles.success} role="status">
              {accentState.error ?? accentState.message}
            </p>
          )}
        </form>
      )}

      {/* Achievements sit with the other identity panels rather than always
                on screen, so Profile opens on the numbers instead of the medals. */}
      {openPanel === 'medals' && (
        <div id="achievements" className={styles.medalsPanel}>
          <button
            type="button"
            className={styles.panelClose}
            aria-label="Close achievements"
            onClick={() => setOpenPanel(null)}
          >
            <CrossIcon />
          </button>
          <MemberMedals
            memberId={member.id}
            boards={medalBoards}
            medalDate={medalDate}
            today={currentDate}
          />
        </div>
      )}

      {/* With the other choices about how Profile looks, rather than buried in
          Account beside the password fields. */}
      <fieldset className={styles.appearance}>
        <legend className="sr-only">Appearance</legend>
        <div className={styles.appearanceRow}>
          <span className={styles.appearanceLabel} aria-hidden="true">
            Appearance
          </span>
          <div className={styles.themeOptions}>
            {(['light', 'dark'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                onClick={() => selectTheme(option)}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <section className={styles.stats} aria-label="Current measurements">
        <div>
          <span>Weight</span>
          <strong>{currentWeight === null ? '—' : `${currentWeight.toFixed(1)} kg`}</strong>
          <small>
            {weightDifference === null
              ? 'Set a goal below'
              : `${weightDifference.toFixed(1)} kg to goal`}
          </small>
        </div>
        <div>
          <span>BMI</span>
          <strong>{currentBmi?.toFixed(1) ?? '—'}</strong>
          <small>
            {profile.targetBmi ? `Goal ${profile.targetBmi.toFixed(1)}` : 'Set a goal below'}
          </small>
        </div>
        <div>
          <span>Height</span>
          <strong>{profile.heightCm ? `${profile.heightCm} cm` : '—'}</strong>
          <small>{profile.age ? `Age ${profile.age}` : 'Add your details'}</small>
        </div>
      </section>

      <section
        id="log-weight"
        className={`${styles.section} ${ui.card}`}
        aria-labelledby="weight-history-heading"
      >
        <div className={styles.sectionHead}>
          <div>
            <p>Progress</p>
            <h2 id="weight-history-heading">Weight progress</h2>
          </div>
          {profile.targetWeightKg && <span>Goal {profile.targetWeightKg.toFixed(1)} kg</span>}
        </div>

        <div className={styles.chartControls}>
          <fieldset className={styles.targetModes}>
            <legend className="sr-only">Weight chart range</legend>
            {weightChartRanges.map((range) => (
              <button
                key={range.value}
                type="button"
                data-active={weightChartRange === range.value}
                aria-pressed={weightChartRange === range.value}
                onClick={() => setWeightChartRange(range.value)}
              >
                {range.label}
              </button>
            ))}
          </fieldset>
        </div>

        {chartMeasurements.length > 0 ? (
          <div className={styles.weightChart}>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label={chartLabel}
              preserveAspectRatio="xMidYMid meet"
            >
              {chartTicks.map((tick) => (
                <g key={tick}>
                  <line
                    className={styles.chartGrid}
                    x1={CHART_LEFT}
                    x2={CHART_WIDTH - CHART_RIGHT}
                    y1={chartY(tick)}
                    y2={chartY(tick)}
                  />
                  <text className={styles.chartValue} x={CHART_LEFT - 7} y={chartY(tick)}>
                    {tick.toFixed(1)}
                  </text>
                </g>
              ))}
              {profile.targetWeightKg && (
                <line
                  className={styles.chartGoal}
                  x1={CHART_LEFT}
                  x2={CHART_WIDTH - CHART_RIGHT}
                  y1={chartY(profile.targetWeightKg)}
                  y2={chartY(profile.targetWeightKg)}
                />
              )}
              {chartMeasurements.length > 1 && (
                <polyline className={styles.chartLine} points={chartPoints} />
              )}
              {chartMeasurements.map((measurement) => (
                <circle
                  className={styles.chartPoint}
                  key={measurement.date}
                  cx={chartX(measurement.date)}
                  cy={chartY(measurement.weightKg)}
                  r="5"
                />
              ))}
              <text
                className={styles.chartMonth}
                x={chartX(chartMeasurements[0].date)}
                y={CHART_HEIGHT - 8}
              >
                {chartDateLabel.format(new Date(`${chartMeasurements[0].date}T12:00:00`))}
              </text>
              {chartMeasurements.length > 1 && (
                <text
                  className={styles.chartMonth}
                  data-last
                  x={chartX(chartMeasurements[chartMeasurements.length - 1].date)}
                  y={CHART_HEIGHT - 8}
                >
                  {chartDateLabel.format(
                    new Date(`${chartMeasurements[chartMeasurements.length - 1].date}T12:00:00`)
                  )}
                </text>
              )}
            </svg>
            <div className={styles.chartLegend}>
              <span>
                <i />
                Weight
              </span>
              {profile.targetWeightKg && (
                <span data-goal>
                  <i />
                  Goal
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className={styles.empty}>No weights saved for this period yet.</p>
        )}

        <form className={styles.inlineForm} onSubmit={weightAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <label htmlFor="profile-weight-date">
            <span>Date</span>
            <input
              id="profile-weight-date"
              type="date"
              name="date"
              max={currentDate}
              value={weightDate}
              onChange={(event) => changeWeightDate(event.target.value)}
              required
            />
          </label>
          <label htmlFor="profile-weight">
            <span>Weight</span>
            <span className={styles.inputUnit}>
              <input
                id="profile-weight"
                type="number"
                name="weightKg"
                min={25}
                max={500}
                step={0.1}
                value={monthlyWeightDraft}
                onChange={(event) => changeMonthlyWeight(event.target.value)}
                required
              />
              <span>kg</span>
            </span>
          </label>
          <button
            type="submit"
            className={`${styles.saveButton} ${ui.primaryButton}`}
            disabled={weightPending}
          >
            {weightPending ? 'Saving…' : 'Save weight'}
          </button>
          {(weightState.error || weightState.message) && (
            <p className={weightState.error ? styles.error : styles.success} role="status">
              {weightState.error ?? weightState.message}
            </p>
          )}
        </form>
      </section>

      <section className={`${styles.section} ${ui.card}`} aria-labelledby="details-heading">
        <div className={styles.sectionHead}>
          <div>
            <p>Profile details</p>
            <h2 id="details-heading">Your information</h2>
          </div>
        </div>

        <form className={styles.detailsForm} onSubmit={infoAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <input type="hidden" name="currentDate" value={currentDate} />
          <input type="hidden" name="saveCurrentWeight" value={String(currentWeightChanged)} />
          <fieldset className={styles.detailGroup}>
            <legend>Personal info</legend>
            <div className={styles.detailFields}>
              <label htmlFor="profile-name-input">
                <span>First name</span>
                <input
                  id="profile-name-input"
                  type="text"
                  name="name"
                  maxLength={50}
                  defaultValue={member.firstName ?? member.name}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label htmlFor="profile-surname">
                <span>Surname</span>
                <input
                  id="profile-surname"
                  type="text"
                  name="surname"
                  maxLength={50}
                  defaultValue={member.surname ?? ''}
                  autoComplete="family-name"
                />
              </label>
              <label htmlFor="profile-age">
                <span>Age</span>
                <input
                  id="profile-age"
                  type="number"
                  name="age"
                  min={13}
                  max={120}
                  step={1}
                  defaultValue={profile.age ?? ''}
                />
              </label>
            </div>
          </fieldset>
          <fieldset className={styles.detailGroup}>
            <legend>Measurements</legend>
            <div className={styles.detailFields}>
              <label htmlFor="profile-height">
                <span>Height</span>
                <span className={styles.inputUnit}>
                  <input
                    id="profile-height"
                    type="number"
                    name="heightCm"
                    min={100}
                    max={250}
                    step={0.1}
                    defaultValue={profile.heightCm ?? ''}
                  />
                  <span>cm</span>
                </span>
              </label>
              <label htmlFor="profile-current-weight">
                <span>Current weight</span>
                <span className={styles.inputUnit}>
                  <input
                    id="profile-current-weight"
                    type="number"
                    name="currentWeightKg"
                    min={25}
                    max={500}
                    step={0.1}
                    value={currentWeightDraft}
                    onChange={(event) => changeCurrentWeight(event.target.value)}
                    aria-label="Current weight"
                    aria-describedby="profile-current-weight-note"
                  />
                  <span>kg</span>
                </span>
                <small id="profile-current-weight-note" className={styles.fieldNote}>
                  Saves to today’s weight progress
                </small>
              </label>
            </div>
          </fieldset>
          <div className={styles.formActions}>
            <button
              type="submit"
              className={`${styles.saveButton} ${ui.primaryButton}`}
              disabled={infoPending}
            >
              {infoPending ? 'Saving…' : 'Save info'}
            </button>
            {(infoState.error || infoState.message) && (
              <p className={infoState.error ? styles.error : styles.success} role="status">
                {infoState.error ?? infoState.message}
              </p>
            )}
          </div>
        </form>

        <form className={styles.detailsForm} onSubmit={targetsAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <fieldset id="goals-and-targets" className={styles.detailGroup}>
            <legend>Goals and targets</legend>
            <div className={styles.detailFields}>
              <input type="hidden" name="targetProtein" value={effectiveTargetGrams.protein} />
              <input type="hidden" name="targetCarbs" value={effectiveTargetGrams.carbs} />
              <input type="hidden" name="targetFat" value={effectiveTargetGrams.fat} />
              <label htmlFor="profile-weight-goal">
                <span>Weight goal</span>
                <span className={styles.inputUnit}>
                  <input
                    id="profile-weight-goal"
                    type="number"
                    name="targetWeightKg"
                    min={25}
                    max={500}
                    step={0.1}
                    defaultValue={profile.targetWeightKg ?? ''}
                  />
                  <span>kg</span>
                </span>
              </label>
              <label htmlFor="profile-bmi-goal">
                <span>BMI goal</span>
                <input
                  id="profile-bmi-goal"
                  type="number"
                  name="targetBmi"
                  min={10}
                  max={60}
                  step={0.1}
                  defaultValue={profile.targetBmi ?? ''}
                />
              </label>
              <label htmlFor="profile-sleep-target">
                <span>Sleep target</span>
                <span className={styles.inputUnit}>
                  <input
                    id="profile-sleep-target"
                    aria-label="Sleep target"
                    type="number"
                    name="targetSleepHours"
                    min={1}
                    max={24}
                    step={0.25}
                    defaultValue={member.targets.sleepHours ?? defaultTargets.sleepHours}
                    required
                  />
                  <span>hours</span>
                </span>
              </label>
              <label htmlFor="profile-calorie-target">
                <span>Calorie target</span>
                <span className={styles.inputUnit}>
                  <input
                    id="profile-calorie-target"
                    aria-label="Calorie target"
                    type="number"
                    name="targetCalories"
                    min={1}
                    max={20000}
                    step={1}
                    value={targetCaloriesDraft}
                    onChange={(event) => changeTargetCalories(event.target.value)}
                    required
                  />
                  <span>kcal</span>
                </span>
              </label>
              <label className={styles.stepCaloriesPreference}>
                <input
                  type="checkbox"
                  aria-label="Count burned kcal towards target"
                  checked={includeStepCalories}
                  onChange={(event) => setIncludeStepCalories(event.target.checked)}
                />
                <span>Count burned kcal towards target</span>
              </label>
              <fieldset className={styles.targetModes}>
                <legend className="sr-only">Enter macro targets as</legend>
                {(['grams', 'percent'] as ProfileMacroMode[]).map((option) => (
                  <button
                    type="button"
                    key={option}
                    data-active={targetMacroMode === option}
                    aria-pressed={targetMacroMode === option}
                    onClick={() => switchTargetMacroMode(option)}
                  >
                    {option === 'grams' ? 'Grams' : 'Percent'}
                  </button>
                ))}
              </fieldset>
              {macroKeys.map((key) => (
                <label htmlFor={`profile-${key}-target`} key={key}>
                  <span>{macroLabels[key]} target</span>
                  <span className={styles.inputUnit}>
                    <input
                      id={`profile-${key}-target`}
                      aria-label={`${macroLabels[key]} target ${targetMacroMode === 'grams' ? 'grams' : 'percentage'}`}
                      type="number"
                      inputMode="numeric"
                      min={targetMacroMode === 'grams' ? 1 : 0}
                      max={targetMacroMode === 'grams' ? 2000 : 100}
                      step={1}
                      value={
                        targetMacroMode === 'grams' ? targetGramDraft[key] : targetPercentDraft[key]
                      }
                      onChange={(event) => {
                        if (targetMacroMode === 'grams') {
                          changeTargetGram(key, event.target.value);
                        } else {
                          setTargetPercentDraft((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }));
                        }
                      }}
                      required
                    />
                    <span>{targetMacroMode === 'grams' ? 'g' : '%'}</span>
                  </span>
                </label>
              ))}
              {targetMacroMode === 'percent' && (
                <p className={styles.targetSplit} data-off={targetSplitOff}>
                  Split adds up to <strong>{targetSplit}%</strong>
                  {targetSplitOff ? ' — it needs to be 100%.' : '.'}
                </p>
              )}
            </div>
          </fieldset>
          <div className={styles.formActions}>
            <button
              type="submit"
              className={`${styles.saveButton} ${ui.primaryButton}`}
              disabled={targetsPending || targetSplitOff}
            >
              {targetsPending ? 'Saving…' : 'Save targets'}
            </button>
            {(targetsState.error || targetsState.message) && (
              <p className={targetsState.error ? styles.error : styles.success} role="status">
                {targetsState.error ?? targetsState.message}
              </p>
            )}
          </div>
        </form>
      </section>

      <section
        id="account-settings"
        className={`${styles.account} ${ui.card}`}
        aria-labelledby="account-heading"
      >
        <h2 id="account-heading">Account</h2>
        {account && (
          <form className={styles.accountForm} onSubmit={accountAction}>
            <label>
              <span>Username</span>
              <input value={account.username} disabled />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                name="email"
                defaultValue={account.email}
                autoComplete="email"
                required
              />
            </label>
            <button
              type="button"
              className={styles.passwordToggle}
              aria-expanded={passwordOpen}
              disabled={accountPending}
              onClick={() => setPasswordOpen((open) => !open)}
            >
              {passwordOpen ? 'Cancel password change' : 'Change password…'}
            </button>
            {passwordOpen && (
              <div className={styles.passwordFields}>
                <label>
                  <span>Current password</span>
                  <input
                    type="password"
                    name="currentPassword"
                    value={currentPasswordDraft}
                    onChange={(event) => setCurrentPasswordDraft(event.target.value)}
                    disabled={!passwordOpen}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    name="newPassword"
                    value={newPasswordDraft}
                    onChange={(event) => setNewPasswordDraft(event.target.value)}
                    disabled={!passwordOpen}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>
            )}
            <div className={styles.accountSave}>
              <button
                type="submit"
                className={`${styles.saveButton} ${ui.primaryButton}`}
                disabled={accountPending}
              >
                {accountPending ? 'Saving…' : 'Save account'}
              </button>
              {(accountState.error || accountState.message) && (
                <p className={accountState.error ? styles.error : styles.success} role="status">
                  {accountState.error ?? accountState.message}
                </p>
              )}
            </div>
          </form>
        )}
        <div className={styles.accountActions}>
          <button type="button" className={styles.logout} onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Logging out…' : 'Log out'}
          </button>
          <button type="button" className={styles.removeMember} onClick={() => setRemoveOpen(true)}>
            {canRemoveOthers ? 'Remove someone' : 'Remove my account'}
          </button>
        </div>
        <RemoveMemberDialog
          members={members}
          viewerId={member.id}
          canRemoveOthers={canRemoveOthers}
          open={removeOpen}
          onClose={() => setRemoveOpen(false)}
        />
      </section>
    </div>
  );
};
