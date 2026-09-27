'use client';

import { CrossIcon, UploadIcon } from '@components/Icons/Icons';
import { MemberMedals } from '@components/MedalLeaderboard/MedalLeaderboard';
import { RemoveMemberDialog } from '@components/RemoveMemberDialog/RemoveMemberDialog';
import { avatarOptions, avatarUploadTypes, isAvatarPath } from '@data/avatarData';
import { accentHex, accentNames, defaultTargets } from '@data/fitnessData';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    type CSSProperties,
    useActionState,
    useEffect,
    useRef,
    useState,
    useTransition,
} from 'react';
import {
    type ActionState,
    saveAvatar,
    saveProfileAccent,
    saveProfileDetails,
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
import type { Member, MemberProfile, WeightMeasurement } from '@/types/fitness';

import styles from './ProfileView.module.css';

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
}

const initial: ActionState = { ok: false };
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
type ProfileMacroMode = 'grams' | 'percent';
type WeightChartRange = 'month' | 'threeMonths' | 'sixMonths' | 'year';
type ProfileMacroDraft = Record<MacroKey, string>;

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
    member,
    profile,
    account = null,
    measurements,
    currentDate,
    medalDate = currentDate,
    medalBoards = [],
    canRemoveOthers = false,
}: ProfileViewProps) => {
    const router = useRouter();
    const [removeOpen, setRemoveOpen] = useState(false);
    const [avatarOpen, setAvatarOpen] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [selectedAvatar, setSelectedAvatar] = useState(
        member?.avatarPath && !isAvatarPath(member.avatarPath) ? 'upload' : (member?.avatarPath ?? '')
    );
    const [selectedAccent, setSelectedAccent] = useState(member?.accent ?? 'blue');
    const avatarFileRef = useRef<HTMLInputElement>(null);
    const [signingOut, startSignOut] = useTransition();
    const [profileState, profileAction, profilePending] = useActionState(
        saveProfileDetails,
        initial
    );
    const [weightState, weightAction, weightPending] = useActionState(
        saveWeightMeasurement,
        initial
    );
    const [avatarState, avatarAction, avatarPending] = useActionState(saveAvatar, initial);
    const [accentState, accentAction, accentPending] = useActionState(saveProfileAccent, initial);
    const [accountState, accountAction, accountPending] = useActionState(
        saveAccountSettings,
        {}
    );
    const [passwordOpen, setPasswordOpen] = useState(false);

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

    useEffect(() => {
        if (!member?.id) {
            return;
        }

        const nextWeight = String(currentDateMeasurement?.weightKg ?? currentWeight ?? '');
        setWeightDate(currentDate);
        setCurrentWeightDraft(nextWeight);
        setMonthlyWeightDraft(nextWeight);
        setCurrentWeightChanged(false);
        setSelectedAccent(member.accent);
        const nextGrams = {
            protein: member.targets.protein,
            carbs: member.targets.carbs,
            fat: member.targets.fat,
        };
        setTargetMacroMode('grams');
        setTargetCaloriesDraft(String(member.targets.calories));
        setTargetGramDraft(toMacroDraft(nextGrams));
        setTargetPercentDraft(toMacroDraft(percentsFromGrams(nextGrams)));
    }, [currentDate, currentDateMeasurement?.weightKg, currentWeight, member]);

    useEffect(() => {
        if (avatarState.ok && avatarState.bookedAt) {
            setAvatarOpen(false);
            setAvatarPreview(null);
        }
    }, [avatarState.ok, avatarState.bookedAt]);

    useEffect(
        () => () => {
            if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview);
            }
        },
        [avatarPreview]
    );

    const currentBmi = calculateBmi(currentWeight, profile?.heightCm ?? null);
    const chartRangeMonths = weightChartRanges.find(
        (range) => range.value === weightChartRange
    )?.months ?? 1;
    const chartStartDate = weightRangeStart(currentDate, chartRangeMonths);
    const chartMeasurements = measurements.filter(
        (measurement) => measurement.date >= chartStartDate && measurement.date <= currentDate
    );
    const chartValues = [
        ...chartMeasurements.map((measurement) => measurement.weightKg),
        profile?.targetWeightKg,
    ].filter((value): value is number => value !== null && value !== undefined);
    const chartSpread = chartValues.length > 0 ? Math.max(...chartValues) - Math.min(...chartValues) : 0;
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

    const accent = accentHex[selectedAccent];
    const assignedAccents = new Set(
        members.filter((option) => option.id !== member.id).map((option) => option.accent)
    );
    const uploadedAvatar = member.avatarPath && !isAvatarPath(member.avatarPath)
        ? member.avatarPath
        : null;
    const chooseAvatar = (value: string) => {
        setSelectedAvatar(value);
        setAvatarPreview(null);
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
            date === currentDate
                ? currentWeightDraft
                : String(measurement?.weightKg ?? '')
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
            setTargetGramDraft(toMacroDraft(gramsFromPercents(toPositiveNumber(value), targetPercentNumbers)));
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
            setTargetGramDraft(toMacroDraft(gramsFromPercents(targetCaloriesNumber, targetPercentNumbers)));
        }
        setTargetMacroMode(next);
    };

    return (
        <div className={styles.profile} style={{ '--profile-accent': accent } as CSSProperties}>
            <section className={styles.identity} aria-labelledby="profile-name">
                <div className={styles.avatar}>
                    {member.avatarPath ? (
                        <Image
                            src={member.avatarPath}
                            alt=""
                            width={88}
                            height={88}
                            unoptimized={member.avatarPath.startsWith('http://')}
                        />
                    ) : (
                        member.name.charAt(0).toUpperCase()
                    )}
                </div>
                <div className={styles.identityDetails}>
                    <div>
                        <p>Your profile</p>
                        <h2 id="profile-name">
                            {[member.name, member.surname].filter(Boolean).join(' ')}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className={styles.chooseAvatar}
                        onClick={() => setAvatarOpen((open) => !open)}
                        aria-expanded={avatarOpen}
                        aria-controls="avatar-picker"
                    >
                        Choose profile picture
                    </button>
                </div>
            </section>

            {avatarOpen && (
                <form id="avatar-picker" className={styles.avatarPicker} action={avatarAction}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <div className={styles.avatarPickerHead}>
                        <h3>Profile picture</h3>
                        <button
                            type="button"
                            className={styles.closeAvatarPicker}
                            aria-label="Close profile picture chooser"
                            onClick={() => {
                                setAvatarOpen(false);
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
                                            unoptimized={Boolean(
                                                avatarPreview || uploadedAvatar?.startsWith('http://')
                                            )}
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
                                    onChange={(event) => {
                                        const file = event.currentTarget.files?.[0];
                                        setAvatarPreview(file ? URL.createObjectURL(file) : null);
                                        if (file) {
                                            setSelectedAvatar('upload');
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </fieldset>
                    <div className={styles.avatarActions}>
                        <button
                            type="submit"
                            className={styles.saveButton}
                            disabled={
                                avatarPending ||
                                (selectedAvatar === 'upload' && !avatarPreview && !uploadedAvatar)
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

            <form className={styles.accentPicker} action={accentAction}>
                <input type="hidden" name="memberId" value={member.id} />
                <fieldset>
                    <legend>Profile colour</legend>
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
                    className={styles.saveButton}
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

            <section className={styles.stats} aria-label="Current measurements">
                <div>
                    <span>Weight</span>
                    <strong>{currentWeight === null ? '—' : `${currentWeight.toFixed(1)} kg`}</strong>
                    <small>
                        {weightDifference === null ? 'Set a goal below' : `${weightDifference.toFixed(1)} kg to goal`}
                    </small>
                </div>
                <div>
                    <span>BMI</span>
                    <strong>{currentBmi?.toFixed(1) ?? '—'}</strong>
                    <small>{profile.targetBmi ? `Goal ${profile.targetBmi.toFixed(1)}` : 'Set a goal below'}</small>
                </div>
                <div>
                    <span>Height</span>
                    <strong>{profile.heightCm ? `${profile.heightCm} cm` : '—'}</strong>
                    <small>{profile.age ? `Age ${profile.age}` : 'Add your details'}</small>
                </div>
            </section>

            <MemberMedals
                memberId={member.id}
                boards={medalBoards}
                medalDate={medalDate}
                today={currentDate}
            />

            <section className={styles.section} aria-labelledby="weight-history-heading">
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
                                    <text
                                        className={styles.chartValue}
                                        x={CHART_LEFT - 7}
                                        y={chartY(tick)}
                                    >
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
                            <text className={styles.chartMonth} x={chartX(chartMeasurements[0].date)} y={CHART_HEIGHT - 8}>
                                {chartDateLabel.format(
                                    new Date(`${chartMeasurements[0].date}T12:00:00`)
                                )}
                            </text>
                            {chartMeasurements.length > 1 && (
                                <text
                                    className={styles.chartMonth}
                                    data-last
                                    x={chartX(chartMeasurements[chartMeasurements.length - 1].date)}
                                    y={CHART_HEIGHT - 8}
                                >
                                    {chartDateLabel.format(
                                        new Date(
                                            `${chartMeasurements[chartMeasurements.length - 1].date}T12:00:00`
                                        )
                                    )}
                                </text>
                            )}
                        </svg>
                        <div className={styles.chartLegend}>
                            <span><i />Weight</span>
                            {profile.targetWeightKg && <span data-goal><i />Goal</span>}
                        </div>
                    </div>
                ) : (
                    <p className={styles.empty}>
                        No weights saved for this period yet.
                    </p>
                )}

                <form className={styles.inlineForm} action={weightAction}>
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
                    <button type="submit" className={styles.saveButton} disabled={weightPending}>
                        {weightPending ? 'Saving…' : 'Save weight'}
                    </button>
                    {(weightState.error || weightState.message) && (
                        <p className={weightState.error ? styles.error : styles.success} role="status">
                            {weightState.error ?? weightState.message}
                        </p>
                    )}
                </form>
            </section>

            <section className={styles.section} aria-labelledby="details-heading">
                <div className={styles.sectionHead}>
                    <div>
                        <p>Profile details</p>
                        <h2 id="details-heading">Your information</h2>
                    </div>
                </div>

                <form className={styles.detailsForm} action={profileAction}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <input type="hidden" name="currentDate" value={currentDate} />
                    <input
                        type="hidden"
                        name="saveCurrentWeight"
                        value={String(currentWeightChanged)}
                    />
                    <fieldset className={styles.detailGroup}>
                        <legend>Personal info</legend>
                        <div className={styles.detailFields}>
                            <label htmlFor="profile-name-input">
                                <span>First name</span>
                                <input id="profile-name-input" type="text" name="name" maxLength={50} defaultValue={member.firstName ?? member.name} autoComplete="given-name" required />
                            </label>
                            <label htmlFor="profile-surname">
                                <span>Surname</span>
                                <input id="profile-surname" type="text" name="surname" maxLength={50} defaultValue={member.surname ?? ''} autoComplete="family-name" />
                            </label>
                            <label htmlFor="profile-age">
                                <span>Age</span>
                                <input id="profile-age" type="number" name="age" min={13} max={120} step={1} defaultValue={profile.age ?? ''} />
                            </label>
                        </div>
                    </fieldset>
                    <fieldset className={styles.detailGroup}>
                        <legend>Measurements</legend>
                        <div className={styles.detailFields}>
                            <label htmlFor="profile-height">
                                <span>Height</span>
                                <span className={styles.inputUnit}>
                                    <input id="profile-height" type="number" name="heightCm" min={100} max={250} step={0.1} defaultValue={profile.heightCm ?? ''} />
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
                    <fieldset className={styles.detailGroup}>
                        <legend>Goals and targets</legend>
                        <div className={styles.detailFields}>
                            <input type="hidden" name="targetProtein" value={effectiveTargetGrams.protein} />
                            <input type="hidden" name="targetCarbs" value={effectiveTargetGrams.carbs} />
                            <input type="hidden" name="targetFat" value={effectiveTargetGrams.fat} />
                            <label htmlFor="profile-weight-goal">
                                <span>Weight goal</span>
                                <span className={styles.inputUnit}>
                                    <input id="profile-weight-goal" type="number" name="targetWeightKg" min={25} max={500} step={0.1} defaultValue={profile.targetWeightKg ?? ''} />
                                    <span>kg</span>
                                </span>
                            </label>
                            <label htmlFor="profile-bmi-goal">
                                <span>BMI goal</span>
                                <input id="profile-bmi-goal" type="number" name="targetBmi" min={10} max={60} step={0.1} defaultValue={profile.targetBmi ?? ''} />
                            </label>
                            <label htmlFor="profile-sleep-target">
                                <span>Sleep target</span>
                                <span className={styles.inputUnit}>
                                    <input id="profile-sleep-target" aria-label="Sleep target" type="number" name="targetSleepHours" min={1} max={24} step={0.25} defaultValue={member.targets.sleepHours ?? defaultTargets.sleepHours} required />
                                    <span>hours</span>
                                </span>
                            </label>
                            <label htmlFor="profile-calorie-target">
                                <span>Calorie target</span>
                                <span className={styles.inputUnit}>
                                    <input id="profile-calorie-target" aria-label="Calorie target" type="number" name="targetCalories" min={1} max={20000} step={1} value={targetCaloriesDraft} onChange={(event) => changeTargetCalories(event.target.value)} required />
                                    <span>kcal</span>
                                </span>
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
                                            value={targetMacroMode === 'grams' ? targetGramDraft[key] : targetPercentDraft[key]}
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
                            className={styles.saveButton}
                            disabled={profilePending || targetSplitOff}
                        >
                            {profilePending ? 'Saving…' : 'Save profile'}
                        </button>
                        {(profileState.error || profileState.message) && (
                            <p className={profileState.error ? styles.error : styles.success} role="status">
                                {profileState.error ?? profileState.message}
                            </p>
                        )}
                    </div>
                </form>
            </section>

            <section className={styles.account} aria-labelledby="account-heading">
                <h2 id="account-heading">Account</h2>
                {account && (
                    <form className={styles.accountForm} action={accountAction}>
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
                                        autoComplete="current-password"
                                        required
                                    />
                                </label>
                                <label>
                                    <span>New password</span>
                                    <input
                                        type="password"
                                        name="newPassword"
                                        minLength={8}
                                        maxLength={128}
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                            </div>
                        )}
                        <div className={styles.accountSave}>
                            <button type="submit" className={styles.saveButton} disabled={accountPending}>
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
                    <button
                        type="button"
                        className={styles.logout}
                        onClick={signOut}
                        disabled={signingOut}
                    >
                        {signingOut ? 'Logging out…' : 'Log out'}
                    </button>
                    <button
                        type="button"
                        className={styles.removeMember}
                        onClick={() => setRemoveOpen(true)}
                    >
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