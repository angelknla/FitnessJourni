import ui from '@/styles/ui.module.css';
import { MedalIcon } from '@components/MedalIcon/MedalIcon';
import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { accentHex } from '@data/fitnessData';
import type { CSSProperties } from 'react';
import {
  emptySummary,
  type LogSummary,
  type MedalAward,
  type MedalCategory,
  nutritionTargetScore,
  sleepTargetScore,
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
  format: (summary: LogSummary, member: Member) => string;
  value: (summary: LogSummary, member: Member, workoutCounts: Record<string, number>) => number;
  averageOnly?: boolean;
  fixedMaximum?: number;
}

const hoursFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const formatSleepProgress = (hours: number, target: number) =>
  `${hoursFormat.format(hours)} / ${hoursFormat.format(target)} hours`;

const columns: Column[] = [
  {
    key: 'workouts',
    label: 'Workouts',
    title: 'Workouts completed over the period',
    format: () => '',
    value: (_summary, member, workoutCounts) => workoutCounts[member.id] ?? 0,
  },
  {
    key: 'nutritionTarget',
    label: 'Nutrition',
    title: 'Average calorie and protein closeness to personal targets',
    format: (summary, member) => `${Math.round(nutritionTargetScore(summary, member.targets))}%`,
    value: (summary, member) => nutritionTargetScore(summary, member.targets),
    fixedMaximum: 100,
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
    title: 'Average sleep closeness to personal target',
    format: (s, member) =>
      s.sleepDaysLogged > 0
        ? formatSleepProgress(s.avgSleepHours, member.targets.sleepHours ?? 8)
        : '—',
    value: (summary, member) => sleepTargetScore(summary, member.targets),
    fixedMaximum: 100,
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
      column.fixedMaximum ??
      Math.max(
        1,
        ...members.map((member) =>
          column.value(summaries[member.id] ?? emptySummary, member, workoutCounts)
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
            const value = column.value(summary, member, workoutCounts);
            const display = column.key === 'workouts' ? String(value) : column.format(summary, member);
            const award = memberMedals.find((item) => item.category === column.key);
            return `${column.label} ${display}${award ? `, ${award.rank} medal` : ''}`;
          })
          .join(', ')}`;

        return (
          <li
            className={`${styles.profile} ${ui.card}`}
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
                const value = column.value(summary, member, workoutCounts);
                const display = column.key === 'workouts' ? String(value) : column.format(summary, member);
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
                        {medal && (
                          <MedalIcon rank={medal.rank} size="compact" className={styles.barMedal} />
                        )}
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
