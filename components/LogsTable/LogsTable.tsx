import { accentHex } from '@data/fitnessData';
import type { CSSProperties } from 'react';
import { emptySummary, type LogSummary, type RankedMetric } from '@/lib/aggregate';
import { formatCount, formatMl } from '@/lib/progress';
import type { Member } from '@/types/fitness';

import styles from './LogsTable.module.css';

interface LogsTableProps {
  members: Member[];
  summaries: Record<string, LogSummary>;
  leaders: Record<RankedMetric, string[]>;
  /** Hidden on the "today" view, where a per-day average is the same number. */
  showAverages: boolean;
  caption: string;
}

interface Column {
  key: RankedMetric | 'avgCalories';
  label: string;
  title: string;
  format: (summary: LogSummary) => string;
  ranked: boolean;
  averageOnly?: boolean;
}

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
];

export const LogsTable = ({
  members,
  summaries,
  leaders,
  showAverages,
  caption,
}: LogsTableProps) => {
  const shown = columns.filter((column) => showAverages || !column.averageOnly);

  return (
    <div className={styles.outer}>
      <div className={styles.wrapper}>
        <table className={styles.table}>
          {/* Kept for screen readers; the visible copy sits outside the scroller
              so it cannot be clipped by the horizontal overflow. */}
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.nameHead}>
                Who
              </th>
              {shown.map((column) => (
                <th scope="col" key={column.key}>
                  <abbr title={column.title}>{column.label}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const summary = summaries[member.id] ?? emptySummary;

              return (
                <tr
                  key={member.id}
                  style={{ '--member-accent': accentHex[member.accent] } as CSSProperties}
                >
                  <th scope="row" className={styles.name}>
                    <span className={styles.dot} aria-hidden="true" />
                    {member.name}
                  </th>

                  {shown.map((column) => {
                    const isLeader =
                      column.ranked &&
                      (leaders[column.key as RankedMetric] ?? []).includes(member.id);

                    return (
                      <td className={styles.num} key={column.key}>
                        <span className={styles.value} data-leader={isLeader}>
                          {column.format(summary)}
                          {isLeader && <span className={styles.crown}> ★</span>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.caption}>{caption}</p>
    </div>
  );
};
