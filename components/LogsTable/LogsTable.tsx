import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { accentHex } from '@data/fitnessData';
import type { CSSProperties } from 'react';
import {
  emptySummary,
  type LogSummary,
  type MedalAward,
  type MedalCategory,
} from '@/lib/aggregate';
import { formatCount, formatMl } from '@/lib/progress';
import type { Member } from '@/types/fitness';

import styles from './LogsTable.module.css';

interface LogsTableProps {
  members: Member[];
  summaries: Record<string, LogSummary>;
  workoutCounts: Record<string, number>;
  medals: MedalAward[];
  /** Hidden on the "today" view, where a per-day average is the same number. */
  showAverages: boolean;
}

interface Column {
  key: MedalCategory;
  label: string;
  title: string;
  format: (summary: LogSummary) => string;
  value: (summary: LogSummary, memberId: string, workoutCounts: Record<string, number>) => number;
  averageOnly?: boolean;
}

const hoursFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const formatHours = (hours: number) => `${hoursFormat.format(hours)} h`;

const columns: Column[] = [
  {
    key: 'daysLogged',
    label: 'Days',
    title: 'Days with something logged',
    format: (s) => String(s.daysLogged),
    value: (summary) => summary.daysLogged,
  },
  {
    key: 'workouts',
    label: 'Workouts',
    title: 'Workouts completed over the period',
    format: () => '',
    value: (_summary, memberId, workoutCounts) => workoutCounts[memberId] ?? 0,
  },
  {
    key: 'totalSteps',
    label: 'Steps',
    title: 'Total steps over the period',
    format: (s) => formatCount(s.totalSteps),
    value: (summary) => summary.totalSteps,
  },
  {
    key: 'avgSteps',
    label: 'Steps/day',
    title: 'Average steps per day logged',
    format: (s) => formatCount(s.avgSteps),
    value: (summary) => summary.avgSteps,
    averageOnly: true,
  },
  {
    key: 'avgWaterMl',
    label: 'Water/day',
    title: 'Average water per day logged',
    format: (s) => formatMl(s.avgWaterMl),
    value: (summary) => summary.avgWaterMl,
  },
  {
    key: 'avgSleepHours',
    label: 'Sleep/day',
    title: 'Average sleep per day with sleep logged',
    format: (s) => (s.sleepDaysLogged > 0 ? formatHours(s.avgSleepHours) : '—'),
    value: (summary) => summary.avgSleepHours,
  },
];

export const LogsTable = ({
  members,
  summaries,
  workoutCounts,
  medals,
  showAverages,
}: LogsTableProps) => {
  const shown = columns.filter((column) => showAverages || !column.averageOnly);
  const maximums = new Map(
    shown.map((column) => [
      column.key,
      Math.max(
        1,
        ...members.map((member) =>
          column.value(summaries[member.id] ?? emptySummary, member.id, workoutCounts)
        )
      ),
    ])
  );

  return (
    <ul className={styles.profiles} aria-label="Progress charts by person">
      {members.map((member) => {
        const summary = summaries[member.id] ?? emptySummary;
        const memberMedals = medals.filter((award) => award.memberId === member.id);
        const chartLabel = `${member.name} progress: ${shown
          .map((column) => {
            const value = column.value(summary, member.id, workoutCounts);
            const display = column.key === 'workouts' ? String(value) : column.format(summary);
            const award = memberMedals.find((item) => item.category === column.key);
            return `${column.label} ${display}${award ? `, ${award.rank} medal` : ''}`;
          })
          .join(', ')}`;

        return (
          <li
            className={styles.profile}
            key={member.id}
            style={{ '--member-accent': accentHex[member.accent] } as CSSProperties}
          >
            <header className={styles.profileHead}>
              <h2 className={styles.name}>
                <MemberAvatar member={member} />
                {member.name}
              </h2>
            </header>
            <div
              className={styles.plot}
              role="img"
              aria-label={chartLabel}
              style={{ '--metric-count': shown.length } as CSSProperties}
            >
              {shown.map((column, columnIndex) => {
                const value = column.value(summary, member.id, workoutCounts);
                const display = column.key === 'workouts' ? String(value) : column.format(summary);
                const medal = memberMedals.find((award) => award.category === column.key);

                return (
                  <div
                    className={styles.column}
                    key={column.key}
                    style={{ '--column-index': columnIndex } as CSSProperties}
                  >
                    <span className={styles.value}>{display}</span>
                    <span
                      className={styles.barTrack}
                      aria-hidden="true"
                      style={
                        {
                          '--bar-height': `${(value / (maximums.get(column.key) ?? 1)) * 100}%`,
                        } as CSSProperties
                      }
                    >
                      <span className={styles.barVisual}>
                        <span className={styles.barFill} data-zero={value <= 0} />
                        {medal && <span className={styles.barMedal}>{medal.medal}</span>}
                      </span>
                    </span>
                    <span className={styles.member} title={column.title}>
                      {!showAverages && column.key === 'avgSleepHours' ? 'Sleep' : column.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
