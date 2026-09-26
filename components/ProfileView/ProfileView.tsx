'use client';

import { CrossIcon, UploadIcon } from '@components/Icons/Icons';
import { IdentityDialog } from '@components/IdentityDialog/IdentityDialog';
import { RemoveMemberDialog } from '@components/RemoveMemberDialog/RemoveMemberDialog';
import { avatarOptions, avatarUploadTypes, isAvatarPath } from '@data/avatarData';
import { accentHex } from '@data/fitnessData';
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
    saveProfileDetails,
    saveWeightMeasurement,
} from '@/app/actions';
import { lock } from '@/app/auth-actions';
import { calculateBmi } from '@/lib/data/profile';
import type { Member, MemberProfile, WeightMeasurement } from '@/types/fitness';

import styles from './ProfileView.module.css';

interface ProfileViewProps {
    members: Member[];
    member: Member | null;
    profile: MemberProfile | null;
    measurements: WeightMeasurement[];
    currentMonth: string;
    canRemoveOthers?: boolean;
}

const initial: ActionState = { ok: false };
const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_LEFT = 44;
const CHART_RIGHT = 14;
const CHART_TOP = 14;
const CHART_BOTTOM = 36;

export const ProfileView = ({
    members,
    member,
    profile,
    measurements,
    currentMonth,
    canRemoveOthers = false,
}: ProfileViewProps) => {
    const router = useRouter();
    const [identityOpen, setIdentityOpen] = useState(false);
    const [removeOpen, setRemoveOpen] = useState(false);
    const [avatarOpen, setAvatarOpen] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [selectedAvatar, setSelectedAvatar] = useState(
        member?.avatarPath && !isAvatarPath(member.avatarPath) ? 'upload' : (member?.avatarPath ?? '')
    );
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

    const currentWeight = measurements.at(-1)?.weightKg ?? null;
    const currentMonthMeasurement = measurements.find((item) => item.month.startsWith(currentMonth));
    const [weightMonth, setWeightMonth] = useState(currentMonth);
    const [currentWeightDraft, setCurrentWeightDraft] = useState(
        String(currentMonthMeasurement?.weightKg ?? currentWeight ?? '')
    );
    const [monthlyWeightDraft, setMonthlyWeightDraft] = useState(
        String(currentMonthMeasurement?.weightKg ?? currentWeight ?? '')
    );
    const [currentWeightChanged, setCurrentWeightChanged] = useState(false);

    useEffect(() => {
        if (!member?.id) {
            return;
        }

        const nextWeight = String(currentMonthMeasurement?.weightKg ?? currentWeight ?? '');
        setWeightMonth(currentMonth);
        setCurrentWeightDraft(nextWeight);
        setMonthlyWeightDraft(nextWeight);
        setCurrentWeightChanged(false);
    }, [currentMonth, currentMonthMeasurement?.weightKg, currentWeight, member?.id]);

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
    const chartMeasurements = measurements.slice(-12);
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
    const chartX = (index: number) =>
        chartMeasurements.length === 1
            ? CHART_LEFT + chartPlotWidth / 2
            : CHART_LEFT + (index / (chartMeasurements.length - 1)) * chartPlotWidth;
    const chartY = (weight: number) =>
        CHART_TOP + ((chartMax - weight) / chartRange) * chartPlotHeight;
    const chartPoints = chartMeasurements
        .map((measurement, index) => `${chartX(index)},${chartY(measurement.weightKg)}`)
        .join(' ');
    const chartTicks = [chartMax, (chartMax + chartMin) / 2, chartMin];
    const chartLabel = `Monthly weight trend. ${chartMeasurements
        .map(
            (measurement) =>
                `${monthLabel.format(new Date(`${measurement.month}T12:00:00`))}: ${measurement.weightKg.toFixed(1)} kilograms`
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
                <h2>Choose your profile</h2>
                <p>Pick yourself to view and update your measurements.</p>
                <button type="button" onClick={() => setIdentityOpen(true)}>
                    Who are you?
                </button>
                <IdentityDialog
                    members={members}
                    viewerId={null}
                    open={identityOpen}
                    onClose={() => setIdentityOpen(false)}
                />
                <button type="button" className={styles.logout} onClick={signOut} disabled={signingOut}>
                    {signingOut ? 'Logging out…' : 'Log out'}
                </button>
            </div>
        );
    }

    const accent = accentHex[member.accent];
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
        if (weightMonth === currentMonth) {
            setMonthlyWeightDraft(value);
        }
    };

    const changeWeightMonth = (month: string) => {
        setWeightMonth(month);
        const measurement = measurements.find((item) => item.month.startsWith(month));
        setMonthlyWeightDraft(
            month === currentMonth
                ? currentWeightDraft
                : String(measurement?.weightKg ?? '')
        );
    };

    const changeMonthlyWeight = (value: string) => {
        setMonthlyWeightDraft(value);
        if (weightMonth === currentMonth) {
            setCurrentWeightDraft(value);
            setCurrentWeightChanged(true);
        }
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

            <section className={styles.section} aria-labelledby="weight-history-heading">
                <div className={styles.sectionHead}>
                    <div>
                        <p>Progress</p>
                        <h2 id="weight-history-heading">Monthly weight</h2>
                    </div>
                    {profile.targetWeightKg && <span>Goal {profile.targetWeightKg.toFixed(1)} kg</span>}
                </div>

                {measurements.length > 0 ? (
                    <div className={styles.weightChart}>
                        <svg
                            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                            role="img"
                            aria-label={chartLabel}
                            preserveAspectRatio="none"
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
                            {chartMeasurements.map((measurement, index) => (
                                <circle
                                    className={styles.chartPoint}
                                    key={measurement.month}
                                    cx={chartX(index)}
                                    cy={chartY(measurement.weightKg)}
                                    r="5"
                                />
                            ))}
                            <text className={styles.chartMonth} x={chartX(0)} y={CHART_HEIGHT - 8}>
                                {monthLabel.format(
                                    new Date(`${chartMeasurements[0].month}T12:00:00`)
                                )}
                            </text>
                            {chartMeasurements.length > 1 && (
                                <text
                                    className={styles.chartMonth}
                                    data-last
                                    x={chartX(chartMeasurements.length - 1)}
                                    y={CHART_HEIGHT - 8}
                                >
                                    {monthLabel.format(
                                        new Date(
                                            `${chartMeasurements[chartMeasurements.length - 1].month}T12:00:00`
                                        )
                                    )}
                                </text>
                            )}
                        </svg>
                        <div className={styles.chartLegend}>
                            <span><i />Monthly weight</span>
                            {profile.targetWeightKg && <span data-goal><i />Goal</span>}
                        </div>
                    </div>
                ) : (
                    <p className={styles.empty}>Add this month’s weight to begin tracking.</p>
                )}

                <form className={styles.inlineForm} action={weightAction}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <label htmlFor="profile-month">
                        <span>Month</span>
                        <input
                            id="profile-month"
                            type="month"
                            name="month"
                            max={currentMonth}
                            value={weightMonth}
                            onChange={(event) => changeWeightMonth(event.target.value)}
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
                    <button type="submit" disabled={weightPending}>
                        {weightPending ? 'Saving…' : 'Save month'}
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
                    <input type="hidden" name="currentMonth" value={currentMonth} />
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
                                    Saves to this month’s weight progress
                                </small>
                            </label>
                        </div>
                    </fieldset>
                    <fieldset className={styles.detailGroup}>
                        <legend>Goals and targets</legend>
                        <div className={styles.detailFields}>
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
                        </div>
                    </fieldset>
                    <div className={styles.formActions}>
                        <button type="submit" disabled={profilePending}>
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
                <div className={styles.accountActions}>
                    <button
                        type="button"
                        className={styles.switchUser}
                        onClick={() => setIdentityOpen(true)}
                    >
                        Who are you?
                    </button>
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
                <IdentityDialog
                    members={members}
                    viewerId={member.id}
                    open={identityOpen}
                    onClose={() => setIdentityOpen(false)}
                />
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