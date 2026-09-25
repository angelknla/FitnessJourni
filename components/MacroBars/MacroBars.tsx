import { fillPercent, percentOfTarget } from '@/lib/progress';

import styles from './MacroBars.module.css';

export interface MacroRow {
  label: string;
  value: number;
  target: number;
}

interface MacroBarsProps {
  rows: MacroRow[];
}

export const MacroBars = ({ rows }: MacroBarsProps) => (
  <ul className={styles.list}>
    {rows.map((row) => {
      const pct = percentOfTarget(row.value, row.target);
      const filled = fillPercent(row.value, row.target);

      return (
        <li className={styles.row} key={row.label}>
          <span className={styles.label}>{row.label}</span>

          {/* The bar is decorative here: the numbers beside it are the record. */}
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${filled}%` }} />
          </span>

          <span className={styles.value}>
            <strong className={styles.valueNumber}>{row.value}</strong>
            <span className={styles.valueTarget}>/{row.target} g</span>
          </span>

          <span className="sr-only">
            {row.label}: {row.value} of {row.target} grams, {Math.round(pct)} percent
          </span>
        </li>
      );
    })}
  </ul>
);
