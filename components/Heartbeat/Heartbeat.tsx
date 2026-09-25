import { RunningIcon } from '@components/Icons/Icons';

import styles from './Heartbeat.module.css';

const TRACE = 'M0 9 H13 L15.5 9 L18 3 L21 15 L23.5 9 H29 L31 6.5 L33 9 H56';

const Signal = ({ className }: { className: string }) => (
  <span className={`${styles.signal} ${className}`}>
    <svg
      viewBox="0 0 56 18"
      className={styles.svg}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.trace} d={TRACE} />
    </svg>
    <span className={styles.runner}>
      <RunningIcon size={28} />
    </span>
  </span>
);

/** One bright band travels across the ECG and illuminates the runner last. */
export const Heartbeat = () => (
  <span className={styles.pulse} aria-hidden="true">
    <Signal className={styles.signalTrack} />
    <Signal className={styles.signalSweep} />
  </span>
);
