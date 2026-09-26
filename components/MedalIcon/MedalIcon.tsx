import type { MedalRank } from '@/lib/aggregate';

import styles from './MedalIcon.module.css';

interface MedalIconProps {
    rank: MedalRank;
    size?: 'compact' | 'standard' | 'large';
    className?: string;
}

const rankNumber: Record<MedalRank, string> = {
    gold: '1',
    silver: '2',
    bronze: '3',
};

export const MedalIcon = ({ rank, size = 'standard', className }: MedalIconProps) => (
    <span
        className={[styles.medal, styles[rank], styles[size], className].filter(Boolean).join(' ')}
        data-medal-rank={rank}
        aria-hidden="true"
    >
        <span className={styles.ribbon} />
        <span className={styles.coin}>
            <span className={styles.rank}>{rankNumber[rank]}</span>
        </span>
    </span>
);