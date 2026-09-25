import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { accentHex } from '@data/fitnessData';
import type { CSSProperties } from 'react';
import { fillPercent, formatCount, formatMl } from '@/lib/progress';
import type { DailyLog, Member } from '@/types/fitness';

import styles from './CompareStrip.module.css';

interface CompareStripProps {
  members: Member[];
  logs: Record<string, DailyLog>;
  /** Highlighted without changing anyone's colour — hue follows the person. */
  activeMemberId?: string;
}

interface MiniMeter {
  label: string;
  display: string;
  filled: number;
}

const metersFor = (member: Member, log: DailyLog | undefined): MiniMeter[] => {
  const steps = log?.steps ?? 0;
  const water = log?.waterMl ?? 0;
  const calories = log?.calories ?? 0;

  return [
    {
      label: 'Steps',
      display: formatCount(steps),
      filled: fillPercent(steps, member.targets.steps),
    },
    {
      label: 'Water',
      display: formatMl(water),
      filled: fillPercent(water, member.targets.waterMl),
    },
    {
      label: 'Calories',
      display: formatCount(calories),
      filled: fillPercent(calories, member.targets.calories),
    },
  ];
};

export const CompareStrip = ({ members, logs, activeMemberId }: CompareStripProps) => {
  if (members.length === 0) {
    return null;
  }

  return (
    <section className={styles.wrapper} aria-labelledby="compare-heading">
      <h2 className={styles.heading} id="compare-heading">
        Everyone today
      </h2>

      <ul className={styles.strip}>
        {members.map((member) => {
          const log = logs[member.id];

          return (
            <li
              className={styles.card}
              key={member.id}
              data-active={member.id === activeMemberId}
              style={{ '--member-accent': accentHex[member.accent] } as CSSProperties}
            >
              <p className={styles.name}>
                <MemberAvatar member={member} />
                {member.name}
              </p>

              <ul className={styles.meters}>
                {metersFor(member, log).map((meter) => (
                  <li className={styles.meter} key={meter.label}>
                    <span className={styles.meterLabel}>{meter.label}</span>
                    <span className={styles.meterTrack} aria-hidden="true">
                      <span className={styles.meterFill} style={{ width: `${meter.filled}%` }} />
                    </span>
                    <span className={styles.meterValue}>{meter.display}</span>
                  </li>
                ))}
              </ul>

              {!log && <p className={styles.empty}>Nothing logged yet</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
