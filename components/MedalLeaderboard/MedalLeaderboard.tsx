'use client';

import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import Link from 'next/link';
import { useState } from 'react';
import type { MedalAward, MedalRank } from '@/lib/aggregate';
import type { MedalBoard } from '@/lib/medals';
import type { Member } from '@/types/fitness';

import styles from './MedalLeaderboard.module.css';

interface MedalLeaderboardProps {
    members: Member[];
    boards: MedalBoard[];
}

interface MemberMedalsProps {
    memberId: string;
    boards: MedalBoard[];
}

const rankLabel: Record<MedalRank, string> = {
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
};

const rankPoints: Record<MedalRank, number> = { gold: 3, silver: 2, bronze: 1 };
const rankOrder: MedalRank[] = ['gold', 'silver', 'bronze'];

const orderMembers = (members: Member[], awards: MedalAward[]) =>
    [...members].sort((left, right) => {
        const score = (memberId: string) =>
            awards
                .filter((award) => award.memberId === memberId)
                .reduce((total, award) => total + rankPoints[award.rank], 0);
        return score(right.id) - score(left.id) || left.name.localeCompare(right.name);
    });

const PeriodTabs = ({
    boards,
    activePeriod,
    onChange,
    label,
}: {
    boards: MedalBoard[];
    activePeriod: MedalBoard['period'];
    onChange: (period: MedalBoard['period']) => void;
    label: string;
}) => (
    <div className={styles.tabs} role="tablist" aria-label={label}>
        {boards.map((board) => (
            <button
                type="button"
                role="tab"
                aria-selected={board.period === activePeriod}
                className={styles.tab}
                data-active={board.period === activePeriod}
                key={board.period}
                onClick={() => onChange(board.period)}
            >
                {board.period === 'week' ? 'Week' : 'Month'}
            </button>
        ))}
    </div>
);

export const MedalLeaderboard = ({ members, boards }: MedalLeaderboardProps) => {
    const [activePeriod, setActivePeriod] = useState<MedalBoard['period']>('week');
    const board = boards.find((item) => item.period === activePeriod) ?? boards[0];

    if (!board) {
        return null;
    }

    return (
        <section className={styles.board} aria-labelledby="medal-leaderboard-heading">
            <header className={styles.headingRow}>
                <div className={styles.heading}>
                    <h2 id="medal-leaderboard-heading">Medal leaderboard</h2>
                </div>
                <PeriodTabs
                    boards={boards}
                    activePeriod={board.period}
                    onChange={setActivePeriod}
                    label="Leaderboard period"
                />
            </header>
            <section className={styles.period} role="tabpanel" aria-label={board.label}>
                <h3>{board.label}</h3>
                <ol className={styles.ranking}>
                    {orderMembers(members, board.awards).map((member) => {
                        const awards = board.awards.filter((award) => award.memberId === member.id);
                        const grouped = rankOrder
                            .map((rank) => ({
                                rank,
                                medal: awards.find((award) => award.rank === rank)?.medal,
                                awards: awards.filter((award) => award.rank === rank),
                            }))
                            .filter((group) => group.medal && group.awards.length > 0);
                        return (
                            <li className={styles.person} key={member.id}>
                                <span className={styles.personName}>
                                    <MemberAvatar member={member} />
                                    <strong>{member.name}</strong>
                                </span>
                                {awards.length > 0 ? (
                                    <span
                                        className={styles.medals}
                                        role="img"
                                        aria-label={`${awards.length} medals`}
                                    >
                                        {grouped.map((group) => (
                                            <span
                                                className={styles.medalCount}
                                                key={group.rank}
                                                title={`${rankLabel[group.rank]}: ${group.awards
                                                    .map((award) => award.categoryLabel)
                                                    .join(', ')}`}
                                            >
                                                <span aria-hidden="true">{group.medal}</span>
                                                <strong>{group.awards.length}</strong>
                                            </span>
                                        ))}
                                    </span>
                                ) : (
                                    <span className={styles.none}>No medals</span>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </section>
            <p className={styles.detailNote}>
                See where your medals came from in <Link href="/profile">your profile</Link>.
            </p>
        </section>
    );
};

export const MemberMedals = ({ memberId, boards }: MemberMedalsProps) => {
    const [activePeriod, setActivePeriod] = useState<MedalBoard['period']>('week');
    const board = boards.find((item) => item.period === activePeriod) ?? boards[0];

    if (!board) {
        return null;
    }

    const awards = board.awards.filter((award) => award.memberId === memberId);

    return (
        <section className={styles.shelf} aria-labelledby="profile-medals-heading">
            <header className={styles.headingRow}>
                <div className={styles.heading}>
                    <p>Achievements</p>
                    <h2 id="profile-medals-heading">Your medals</h2>
                </div>
                <PeriodTabs
                    boards={boards}
                    activePeriod={board.period}
                    onChange={setActivePeriod}
                    label="Medal period"
                />
            </header>
            <section className={styles.period} role="tabpanel" aria-label={board.label}>
                <h3>{board.label}</h3>
                {awards.length > 0 ? (
                    <ul className={styles.awards}>
                        {awards.map((award) => (
                            <li key={award.category}>
                                <span className={styles.medal} aria-hidden="true">{award.medal}</span>
                                <span>
                                    <strong>{award.categoryLabel}</strong>
                                    <small>{rankLabel[award.rank]}</small>
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={styles.empty}>No medals awarded yet.</p>
                )}
            </section>
        </section>
    );
};