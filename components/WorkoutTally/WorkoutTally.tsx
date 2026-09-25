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
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className="sr-only">
          Workout counts per person. Week runs Sunday to Saturday: {weekLabel}.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.nameHead}>
              Who
            </th>
            <th scope="col">Today</th>
            <th scope="col">
              <abbr title={`This week — ${weekLabel}`}>Week</abbr>
            </th>
            <th scope="col">
              <abbr title={`This month — ${monthLabel}`}>Month</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const tally = tallies[member.id] ?? empty;
            const target = member.targets.workoutsPerWeek;
            const hitTarget = tally.week >= target;

            return (
              <tr
                key={member.id}
                style={{ '--member-accent': accentHex[member.accent] } as CSSProperties}
              >
                <th scope="row" className={styles.name}>
                  <span className={styles.dot} aria-hidden="true" />
                  {member.name}
                </th>
                <td className={styles.num}>{tally.today}</td>
                <td className={styles.num}>
                  <span className={styles.week} data-hit={hitTarget}>
                    {tally.week}
                    <span className={styles.of}>/{target}</span>
                  </span>
                </td>
                <td className={styles.num}>{tally.month}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <p className={styles.caption}>
      Week runs Sunday to Saturday, matching the playbook. This week: {weekLabel}.
    </p>
  </div>
);
