import { ChevronRightIcon, GroupIcon } from '@components/Icons/Icons';
import Link from 'next/link';

import styles from './GroupBadge.module.css';

interface GroupBadgeProps {
  /** The active group, or null for someone who belongs to none yet. */
  groupName: string | null;
  /** Invitations plus join requests waiting on this person. */
  pendingCount?: number;
}

/**
 * Which group the numbers on this page belong to, and the way through to changing
 * that. It sits beside the member tabs because that is what it qualifies: those
 * people are this group's people, and switching group swaps both.
 *
 * The trailing chevron is doing real work — without it this reads as a label, and
 * nothing says the one control that decides what the whole app shows is a link. A
 * link rather than a menu, because switching group is consequential enough to
 * deserve the page where the members and the consequences are visible.
 */
export const GroupBadge = ({ groupName, pendingCount = 0 }: GroupBadgeProps) => {
  // Ungrouped is a real state with a name of its own, not a blank.
  const label = groupName ?? 'Personal';
  const hint =
    pendingCount > 0
      ? `${label} — manage groups, ${pendingCount} ${pendingCount === 1 ? 'request' : 'requests'} waiting`
      : `${label} — manage groups`;

  return (
    <Link href="/groups" className={styles.badge} aria-label={hint} title={hint}>
      <GroupIcon size={14} />
      <span className={styles.name}>{label}</span>
      <span className={styles.manage}>Manage</span>
      <ChevronRightIcon size={13} />
      {pendingCount > 0 && <span className={styles.pending} aria-hidden="true" />}
    </Link>
  );
};
