import { fillPercent, percentOfTarget } from '@/lib/progress';

import styles from './ProgressRing.module.css';

interface ProgressRingProps {
  label: string;
  /** Pre-formatted for display — "12,431", "2.1 L". */
  display: string;
  targetDisplay: string;
  targetAdjustmentDisplay?: string;
  value: number;
  target: number;
  /**
   * A second, lower threshold drawn as a tick on the track — the playbook's
   * "8,000 minimum" sitting inside the "10,000 ideal" goal.
   */
  floor?: number;
  /**
   * Whether overshooting is a problem. Going past a step goal is a win; going
   * past a calorie budget is worth flagging. Drives the severity colour.
   */
  overIsBad?: boolean;
}

const RADIUS = 42;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const ProgressRing = ({
  label,
  display,
  targetDisplay,
  targetAdjustmentDisplay,
  value,
  target,
  floor,
  overIsBad = false,
}: ProgressRingProps) => {
  const pct = percentOfTarget(value, target);
  const filled = fillPercent(value, target);
  const dash = (filled / 100) * CIRCUMFERENCE;

  const isOver = pct > 100;
  const state = isOver ? (overIsBad ? 'over' : 'complete') : 'partial';

  // Where the "minimum" tick sits, as a fraction of the way round the ring.
  const floorFraction = floor && target > 0 ? Math.min(1, floor / target) : null;

  return (
    <div className={styles.ring} data-state={state}>
      {/* Square box that owns the geometry. The SVG and the readout are both
          absolutely positioned inside it, so the text is centred on the ring
          itself at any size rather than on a separately-guessed height. */}
      <div className={styles.ringBox}>
        <svg
          className={styles.svg}
          viewBox="0 0 100 100"
          role="img"
          aria-label={`${label}: ${display} of ${targetDisplay} target${targetAdjustmentDisplay ? ` plus ${targetAdjustmentDisplay} burned` : ''}, ${Math.round(pct)} percent`}
        >
          <title>{`${label}: ${display} of ${targetDisplay} target${targetAdjustmentDisplay ? ` plus ${targetAdjustmentDisplay} burned` : ''} (${Math.round(pct)}%)`}</title>

          {/* Track: a lighter step of the fill's own ramp, so the whole ring reads. */}
          <circle
            className={styles.track}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />

          {floorFraction !== null && (
            <line
              className={styles.floorTick}
              x1="50"
              y1={50 - RADIUS - STROKE / 2}
              x2="50"
              y2={50 - RADIUS + STROKE / 2}
              transform={`rotate(${floorFraction * 360} 50 50)`}
            />
          )}

          <circle
            className={styles.fill}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
            transform="rotate(-90 50 50)"
          />
        </svg>

        <div className={styles.center}>
          <span className={styles.value}>{display}</span>
          <span className={styles.target}>of {targetDisplay}</span>
          {targetAdjustmentDisplay && (
            <span className={styles.adjustment}>+ {targetAdjustmentDisplay}</span>
          )}
        </div>
      </div>

      <p className={styles.label}>{label}</p>
    </div>
  );
};
