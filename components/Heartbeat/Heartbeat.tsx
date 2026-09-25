import styles from './Heartbeat.module.css';

/**
 * Decorative ECG trace beside the logo. Two copies of the same path: a dim
 * always-visible track, and a short bright segment that sweeps along it via
 * stroke-dashoffset. pathLength normalises the path to 100 units so the dash
 * values do not depend on the geometry.
 */
const TRACE = 'M0 9 H13 L15.5 9 L18 3 L21 15 L23.5 9 H29 L31 6.5 L33 9 H56';

export const Heartbeat = () => (
  <span className={styles.pulse} aria-hidden="true">
    <svg
      viewBox="0 0 56 18"
      className={styles.svg}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.track} d={TRACE} pathLength={100} />
      <path className={styles.sweep} d={TRACE} pathLength={100} />
    </svg>
  </span>
);
