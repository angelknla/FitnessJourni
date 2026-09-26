import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { accentHex } from '@data/fitnessData';
import type { CSSProperties } from 'react';
import { emptySummary, type LogSummary, type RankedMetric } from '@/lib/aggregate';
import { formatCount, formatMl } from '@/lib/progress';
import type { Member } from '@/types/fitness';

import styles from './LogsTable.module.css';

interface LogsTableProps {
  members: Member[];
  summaries: Record<string, LogSummary>;
  workoutCounts: Record<string, number>;
  leaders: Record<RankedMetric, string[]>;
  /** Hidden on the "today" view, where a per-day average is the same number. */
  showAverages: boolean;
  caption: string;
}

interface Column {
  key: RankedMetric | 'avgCalories' | 'avgSleepHours';
  label: string;
  title: string;
  format: (summary: LogSummary) => string;
  ranked: boolean;
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
    ranked: true,
  },
  {
    key: 'totalSteps',
    label: 'Steps',
    title: 'Total steps over the period',
    format: (s) => formatCount(s.totalSteps),
    ranked: true,
  },
  {
    key: 'avgSteps',
    label: 'Steps/day',
    title: 'Average steps per day logged',
    format: (s) => formatCount(s.avgSteps),
    ranked: true,
    averageOnly: true,
  },
  {
    key: 'avgWaterMl',
    label: 'Water/day',
    title: 'Average water per day logged',
    format: (s) => formatMl(s.avgWaterMl),
    ranked: true,
  },
  {
    key: 'avgProteinG',
    label: 'Protein/day',
    title: 'Average protein per day logged',
    format: (s) => `${s.avgProteinG} g`,
    ranked: true,
  },
  {
    key: 'avgCalories',
    label: 'kcal/day',
    title: 'Average calories per day logged — a budget, so there is no winner here',
    format: (s) => formatCount(s.avgCalories),
    ranked: false,
  },
  {
    key: 'avgSleepHours',
    label: 'Sleep/day',
    title: 'Average sleep per day with sleep logged',
    format: (s) => (s.sleepDaysLogged > 0 ? formatHours(s.avgSleepHours) : '—'),
    ranked: false,
  },
];

export const LogsTable = ({
  members,
  summaries,
  workoutCounts,
  leaders,
  showAverages,
  caption,
}: LogsTableProps) => {
  const shown = columns.filter((column) => showAverages || !column.averageOnly);
  const maxSteps = Math.max(
    1,
    ...members.map((member) => (summaries[member.id] ?? emptySummary).totalSteps)
  );

  return (
    <div className={styles.outer}>
      <ul className={styles.profiles} aria-label="Log summaries">
        {members.map((member) => {
          const summary = summaries[member.id] ?? emptySummary;
          const daysLeader = leaders.daysLogged.includes(member.id);
          const stepsLeader = leaders.totalSteps.includes(member.id);

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
                <span className={styles.days} data-leader={daysLeader}>
                  <strong>{summary.daysLogged}</strong>{' '}
                  <abbr title="Days with something logged">days</abbr>
                  {daysLeader && <span className={styles.crown}>★</span>}
                </span>
              </header>

              <div className={styles.stepsFeature}>
                <span>
                  <abbr title="Total steps over the period">Total steps</abbr>
                  {stepsLeader && <span className={styles.crown}>★</span>}
                </span>
                <strong>{formatCount(summary.totalSteps)}</strong>
                <span className={styles.stepsTrack} aria-hidden="true">
                  <span style={{ width: `${(summary.totalSteps / maxSteps) * 100}%` }} />
                </span>
              </div>

              <dl className={styles.metrics}>
                <div className={styles.metric}>
                  <dt>Workouts</dt>
                  <dd>{workoutCounts[member.id] ?? 0}</dd>
                </div>
                {shown
                  .filter((column) => column.key !== 'daysLogged' && column.key !== 'totalSteps')
                  .map((column) => {
                    const isLeader =
                      column.ranked &&
                      (leaders[column.key as RankedMetric] ?? []).includes(member.id);

                    return (
                      <div className={styles.metric} key={column.key}>
                        <dt>
                          <abbr title={column.title}>
                            {!showAverages && column.key === 'avgSleepHours'
                              ? 'Sleep'
                              : column.label}
                          </abbr>
                        </dt>
                        <dd data-leader={isLeader}>
                          {column.format(summary)}
                          {isLeader && <span className={styles.crown}>★</span>}
                        </dd>
                      </div>
                    );
                  })}
              </dl>
            </li>
          );
        })}
      </ul>

      <p className={styles.caption}>{caption}</p>
    </div>
  );
};
