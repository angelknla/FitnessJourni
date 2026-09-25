import { accentHex } from '@data/fitnessData';
import type { CSSProperties } from 'react';
import type { Member } from '@/types/fitness';

import styles from './MemberAvatar.module.css';

interface MemberAvatarProps {
    member: Pick<Member, 'name' | 'accent' | 'avatarPath'>;
    size?: string;
}

export const MemberAvatar = ({ member, size = '1.25rem' }: MemberAvatarProps) => (
    <span
        className={styles.avatar}
        aria-hidden="true"
        data-initial={member.avatarPath ? undefined : member.name.charAt(0).toUpperCase()}
        style={
            {
                '--member-avatar-accent': accentHex[member.accent],
                '--member-avatar-size': size,
            } as CSSProperties
        }
    >
        {member.avatarPath && <img src={member.avatarPath} alt="" />}
    </span>
);