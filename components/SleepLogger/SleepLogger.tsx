'use client';

import { CrossIcon, PlusIcon } from '@components/Icons/Icons';
import { useActionState, useEffect, useState } from 'react';
import { type ActionState, saveSleep } from '@/app/actions';
import type { Member } from '@/types/fitness';

import styles from './SleepLogger.module.css';

interface SleepLoggerProps {
    member: Member;
    date: string;
    sleepHours: number | null;
    canEdit: boolean;
    isToday?: boolean;
}

const initial: ActionState = { ok: false };

const hoursFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const formatHours = (hours: number, target: number) =>
    `${hoursFormat.format(hours)} / ${hoursFormat.format(target)} hours`;

export const SleepLogger = ({
    member,
    date,
    sleepHours,
    canEdit,
    isToday = true,
}: SleepLoggerProps) => {
    const [state, formAction, isPending] = useActionState(saveSleep, initial);
    const [formOpen, setFormOpen] = useState(false);
    const [draft, setDraft] = useState(sleepHours === null ? '' : String(sleepHours));
    const hasSleep = sleepHours !== null;
    const formId = `sleep-log-${member.id}`;
    const parsedDraft = Number(draft);
    const canSave =
        draft !== '' &&
        Number.isFinite(parsedDraft) &&
        parsedDraft >= 0.1 &&
        parsedDraft <= 24 &&
        parsedDraft !== sleepHours;

    useEffect(() => {
        setDraft(sleepHours === null ? '' : String(sleepHours));
    }, [sleepHours]);

    useEffect(() => {
        if (state.ok && state.bookedAt) setFormOpen(false);
    }, [state.ok, state.bookedAt]);

    return (
        <div className={styles.wrapper}>
            <div className={styles.status}>
                <span className={styles.badge} data-done={hasSleep}>
                    {hasSleep
                        ? isToday
                            ? 'Sleep logged today'
                            : 'Sleep logged on this day'
                        : isToday
                            ? 'Sleep not logged today'
                            : 'Sleep not logged on this day'}
                </span>
                {hasSleep && (
                    <strong className={styles.duration}>
                        {formatHours(sleepHours, member.targets.sleepHours ?? 8)}
                    </strong>
                )}
            </div>

            {!canEdit && (
                <p className={styles.readOnly}>
                    {hasSleep
                        ? `Only ${member.name} can change this.`
                        : `Nothing logged. Only ${member.name} can log it.`}
                </p>
            )}

            {canEdit && (
                <div className={styles.disclosure}>
                    <button
                        type="button"
                        className={styles.toggle}
                        aria-expanded={formOpen}
                        aria-controls={formId}
                        onClick={() => setFormOpen((open) => !open)}
                    >
                        <span>{hasSleep ? 'Update sleep' : `Log ${member.name}'s sleep`}</span>
                        {formOpen ? <CrossIcon /> : <PlusIcon />}
                    </button>

                    {formOpen && (
                        <form className={styles.form} action={formAction} id={formId}>
                            <input type="hidden" name="memberId" value={member.id} />
                            <input type="hidden" name="date" value={date} />
                            <label className={styles.field}>
                                <span>Hours slept</span>
                                <input
                                    type="number"
                                    name="sleepHours"
                                    min="0.1"
                                    max="24"
                                    step="0.1"
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    placeholder="7.5"
                                    inputMode="decimal"
                                    required
                                />
                            </label>
                            <div className={styles.actions}>
                                <button type="submit" className={styles.submit} disabled={isPending || !canSave}>
                                    {isPending ? 'Saving…' : 'Save sleep'}
                                </button>
                                {state.error && (
                                    <p className={styles.error} role="alert">
                                        {state.error}
                                    </p>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};