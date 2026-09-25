import { accentHex } from '@data/fitnessData';
import type { CSSProperties } from 'react';
import type { Member, WorkoutTally as Tally } from '@/types/fitness';

import styles from './WorkoutTally.module.css';

interface WorkoutTallyProps {
  members: Member[];
  tallies: Record<string, Tally>;
  /** Formatted range label, e.g. "Sun 21 – Sat 27 Sept". */
  weekLabel: string;
  monthLabel: string;
}

const empty: Tally = { today: 0, week: 0, month: 0 };

export const WorkoutTally = ({ members, tallies, weekLabel, monthLabel }: WorkoutTallyProps) => (
  <div className={styles.outer}>
    <ul className={styles.cards} aria-label="Workout counts per person">
      {members.map((member) => {
        const tally = tallies[member.id] ?? empty;
        const target = member.targets.workoutsPerWeek;
        const hitTarget = tally.week >= target;
        const progress = Math.min(100, (tally.week / target) * 100);

        return (
          <li
            className={styles.card}
            key={member.id}
            style={
              {
                '--member-accent': accentHex[member.accent],
                '--week-progress': progress,
              } as CSSProperties
            }
          >
            <header className={styles.cardHead}>
              <h3 className={styles.name}>
                <span className={styles.dot} aria-hidden="true" />
                {member.name}
              </h3>
              <span className={styles.today} data-done={tally.today > 0}>
                <strong>{tally.today}</strong> today
              </span>
            </header>

            <div className={styles.cardBody}>
              <div
                className={styles.ring}
                data-hit={hitTarget}
                role="img"
                aria-label={`${tally.week} of ${target} recommended workouts this week`}
              >
                <span>
                  <strong>{tally.week}</strong>
                  <small>of {target}</small>
                </span>
              </div>

              <div className={styles.periods}>
                <div>
                  <span>This week</span>
                  <strong>{hitTarget ? 'Target met' : `${target - tally.week} to target`}</strong>
                  <small>{weekLabel}</small>
                </div>
                <div>
                  <span>This month</span>
                  <strong>{tally.month} workouts</strong>
                  <small>{monthLabel}</small>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>

    <p className={styles.caption}>
      Week runs Sunday to Saturday, matching the playbook. This week: {weekLabel}. The second number
      is the recommended count — more than that is fine.
    </p>
  </div>
);
