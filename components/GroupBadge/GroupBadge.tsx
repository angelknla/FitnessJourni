import { GroupIcon, SwitchIcon } from '@components/Icons/Icons';
import Image from 'next/image';
import Link from '@components/NavigationLink/NavigationLink';

import styles from './GroupBadge.module.css';

interface GroupBadgeProps {
  /** The active group, or null for someone who belongs to none yet. */
  groupName: string | null;
  /** The group's picture; the two-figure icon stands in when there is none. */
  imagePath?: string | null;
  /** Invitations plus join requests waiting on this person. */
  pendingCount?: number;
}

/**
 * Which group the numbers on this page belong to, and the way through to changing
 * that. It sits beside the member tabs because that is what it qualifies: those
 * people are this group's people, and switching group swaps both.
 *
 * The trailing swap arrows are doing real work — without them this reads as a
 * label, and nothing says the one control that decides what the whole app shows
 * leads anywhere. The same icon marks the Switch to button on /groups, so the
 * badge and the thing it leads to are visibly the same errand.
 *
 * A link rather than a menu, because switching group is consequential enough to
 * deserve the page where the members and the consequences are visible.
 */
export const GroupBadge = ({ groupName, imagePath = null, pendingCount = 0 }: GroupBadgeProps) => {
  // Ungrouped is a real state with a name of its own, not a blank.
  const label = groupName ?? 'Personal';
  const hint =
    pendingCount > 0
      ? `${label} — manage groups, ${pendingCount} ${pendingCount === 1 ? 'request' : 'requests'} waiting`
      : `${label} — manage groups`;

  return (
    <Link href="/groups" className={styles.badge} aria-label={hint} title={hint}>
      {imagePath ? (
        <Image
          className={styles.image}
          src={imagePath}
          alt=""
          /*
           * Asked for at 64px though drawn at 18. These are the display size to
           * Next, which picks a variant to match — and a 48px variant of a wide
           * photo has about ten usable pixels of height once `cover` has cropped
           * it, which on a 3x phone reads as a smear. 64 covers 18 at 3x.
           */
          width={64}
          height={64}
          unoptimized={imagePath.startsWith('http://')}
        />
      ) : (
        <GroupIcon size={14} />
      )}
      <span className={styles.name}>{label}</span>
      <span className={styles.manage}>Manage</span>
      <SwitchIcon size={13} />
      {pendingCount > 0 && <span className={styles.pending} aria-hidden="true" />}
    </Link>
  );
};
