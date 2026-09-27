'use client';

import { MedalIcon } from '@components/MedalIcon/MedalIcon';
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

const rankPoints: Record<MedalRank, number> = { gold: 5, silver: 3, bronze: 1 };
const rankOrder: MedalRank[] = ['gold', 'silver', 'bronze'];
const periodTabLabel: Record<MedalBoard['period'], string> = {
    day: 'Today',
    week: 'Week',
    month: 'Month',
};

export const medalPoints = (awards: MedalAward[]) =>
    awards.reduce((total, award) => total + rankPoints[award.rank], 0);

const orderMembers = (members: Member[], awards: MedalAward[]) =>
    [...members].sort((left, right) => {
        const score = (memberId: string) => medalPoints(
            awards.filter((award) => award.memberId === memberId)
        );
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
                {periodTabLabel[board.period]}
            </button>
        ))}
    </div>
);

export const MedalLeaderboard = ({ members, boards }: MedalLeaderboardProps) => {
    const [activePeriod, setActivePeriod] = useState<MedalBoard['period']>('day');
    const board = boards.find((item) => item.period === activePeriod) ?? boards[0];

    if (!board) {
        return null;
    }

    const rankedMembers = orderMembers(members, board.awards);
    const leaderPoints = rankedMembers[0]
        ? medalPoints(board.awards.filter((award) => award.memberId === rankedMembers[0].id))
        : 0;
    const leaders = leaderPoints > 0
        ? rankedMembers.filter(
            (member) => medalPoints(
                board.awards.filter((award) => award.memberId === member.id)
            ) === leaderPoints
        )
        : [];
    const leaderNames = leaders.map((member) => member.name).join(' & ');
    const periodPhrase = board.period === 'day'
        ? 'today'
        : board.period === 'week'
            ? 'this week'
            : 'this month';

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
            {leaders.length > 0 && (
                <p className={styles.leaderNote}>
                    <strong>{leaderNames}</strong> {leaders.length > 1 ? 'are' : 'is'} leading{' '}
                    {periodPhrase} — you&apos;re {leaders.length > 1 ? 'winners' : 'a winner'}, baby!
                </p>
            )}
            <section className={styles.period} role="tabpanel" aria-label={board.label}>
                <h3>{board.label}</h3>
                <ol className={styles.ranking}>
                    {rankedMembers.map((member) => {
                        const awards = board.awards.filter((award) => award.memberId === member.id);
                        const points = medalPoints(awards);
                        const grouped = rankOrder
                            .map((rank) => ({
                                rank,
                                awards: awards.filter((award) => award.rank === rank),
                            }))
                            .filter((group) => group.awards.length > 0);
                        return (
                            <li className={styles.person} key={member.id}>
                                <span className={styles.personName}>
                                    <MemberAvatar member={member} />
                                    <strong>{member.name}</strong>
                                </span>
                                <span className={styles.result}>
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
                                                    <MedalIcon rank={group.rank} size="large" />
                                                    <strong>{group.awards.length}</strong>
                                                </span>
                                            ))}
                                        </span>
                                    ) : (
                                        <span className={styles.none}>No medals</span>
                                    )}
                                    <strong className={styles.points}>
                                        {points} pts
                                    </strong>
                                </span>
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
    const [activePeriod, setActivePeriod] = useState<MedalBoard['period']>('day');
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
                                <MedalIcon rank={award.rank} />
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