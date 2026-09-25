'use client';

import { accentHex, accentNames, nextAccent } from '@data/fitnessData';
import { type CSSProperties, useActionState, useEffect, useRef, useState } from 'react';
import { type ActionState, addMember } from '@/app/actions';
import type { AccentName } from '@/types/fitness';

import styles from './AddMemberForm.module.css';

export interface MemberCreateOption {
    id: string;
    name: string;
    accent: AccentName;
}

interface MemberCreateFormProps {
    members: MemberCreateOption[];
    embedded?: boolean;
    onCancel?: () => void;
    onMemberAdded: (member: MemberCreateOption) => void;
}

const initial: ActionState = { ok: false };

export const MemberCreateForm = ({
    members,
    embedded = false,
    onCancel,
    onMemberAdded,
}: MemberCreateFormProps) => {
    const [state, formAction, isPending] = useActionState(addMember, initial);
    const [accent, setAccent] = useState<AccentName>(
        nextAccent(members.map((member) => member.accent))
    );
    const reportedId = useRef<string | null>(null);

    useEffect(() => {
        if (
            state.newMemberId &&
            state.newMemberName &&
            state.newMemberAccent &&
            state.newMemberId !== reportedId.current
        ) {
            reportedId.current = state.newMemberId;
            onMemberAdded({
                id: state.newMemberId,
                name: state.newMemberName,
                accent: state.newMemberAccent,
            });
        }
    }, [state.newMemberAccent, state.newMemberId, state.newMemberName, onMemberAdded]);

    const used = members.map((member) => member.accent);

    return (
        <form className={embedded ? `${styles.form} ${styles.embedded}` : styles.form} action={formAction}>
            <input type="hidden" name="sortOrder" value={members.length} />

            <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Add a person</legend>

                <label className={styles.nameField}>
                    <span className={styles.fieldLabel}>Name</span>
                    <input type="text" name="name" maxLength={40} required autoComplete="off" />
                </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend className={styles.fieldLabel}>Colour</legend>

                <div className={styles.swatches}>
                    {accentNames.map((option) => {
                        const taken = used.includes(option);

                        return (
                            <label
                                className={styles.swatch}
                                key={option}
                                style={{ '--swatch': accentHex[option] } as CSSProperties}
                            >
                                <input
                                    className={styles.control}
                                    type="radio"
                                    name="accent"
                                    value={option}
                                    checked={accent === option}
                                    disabled={taken}
                                    aria-label={taken ? `${option} — already taken` : option}
                                    onChange={() => setAccent(option)}
                                />
                                <span className={styles.dot} />
                            </label>
                        );
                    })}
                </div>

                <p className={styles.chosen}>
                    Chosen: <strong className={styles.chosenName}>{accent}</strong>
                </p>
            </fieldset>

            <p className={styles.hint}>
                Targets start at the playbook defaults — 2,500 kcal, 156 g protein, 10k steps, 2.5 L — and
                can be changed per person later.
            </p>

            <div className={styles.actions}>
                {onCancel && (
                    <button type="button" className={styles.cancel} onClick={onCancel}>
                        Back
                    </button>
                )}
                <button type="submit" className={styles.submit} disabled={isPending}>
                    {isPending ? 'Adding…' : 'Add person'}
                </button>

                {state.error && (
                    <p className={styles.error} role="alert">
                        {state.error}
                    </p>
                )}
            </div>
        </form>
    );
};