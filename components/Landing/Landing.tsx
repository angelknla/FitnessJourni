import { DumbbellIcon, GroupIcon, RunningIcon } from '@components/Icons/Icons';
import { LoginButton } from '@components/LoginButton/LoginButton';

import styles from './Landing.module.css';

const points = [
  {
    Icon: RunningIcon,
    title: 'One place for the day',
    copy: 'Steps, water, calories and macros — logged in seconds, not managed in a spreadsheet.',
  },
  {
    Icon: GroupIcon,
    title: 'See each other',
    copy: "Everyone's day side by side, so a quiet week shows up before it becomes a quiet month.",
  },
  {
    Icon: DumbbellIcon,
    title: 'Train together',
    copy: 'Agree a day, a time and an activity, and everyone in the group sees it.',
  },
];

export const Landing = () => (
  <section className={styles.landing}>
    <div className={styles.hero}>
      <p className={styles.eyebrow}>Move. Train. Grow.</p>
      <h1 className={styles.title}>
        Stronger days.
        <br />
        <span className={styles.accent}>Together.</span>
      </h1>
      <p className={styles.subtitle}>
        Build momentum with every workout, every walk, every small win. Your daily progress, shared
        with the people who keep you going.
      </p>

      <div className={styles.cta}>
        <LoginButton variant="primary" />
      </div>
      <div className={styles.heroArt} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>

    <ul className={styles.points}>
      {points.map((point) => (
        <li className={styles.point} key={point.title}>
          <span className={styles.pointMark} aria-hidden="true">
            <point.Icon size={18} />
          </span>
          <h2 className={styles.pointTitle}>{point.title}</h2>
          <p className={styles.pointCopy}>{point.copy}</p>
        </li>
      ))}
    </ul>
  </section>
);
