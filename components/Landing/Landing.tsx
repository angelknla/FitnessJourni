import { LoginButton } from '@components/LoginButton/LoginButton';

import styles from './Landing.module.css';

const points = [
  {
    title: 'One place for the day',
    copy: 'Steps, water, calories and macros — logged in seconds, not managed in a spreadsheet.',
  },
  {
    title: 'See each other',
    copy: "Everyone's day side by side, so a quiet week is visible before it becomes a quiet month.",
  },
  {
    title: 'Train together',
    copy: 'Agree a day, a time and an activity, and it shows up for all three of you.',
  },
];

export const Landing = () => (
  <section className={styles.landing}>
    <div className={styles.hero}>
      <p className={styles.eyebrow}>Private tracker</p>
      <h1 className={styles.title}>
        Own your <span className={styles.accent}>fitness journey</span>
      </h1>
      <p className={styles.subtitle}>
        A shared log for Dillon, Angel and Bradley — training, steps and food, kept honest by being
        visible to each other.
      </p>

      <div className={styles.cta}>
        <LoginButton variant="primary" />
      </div>
    </div>

    <ul className={styles.points}>
      {points.map((point) => (
        <li className={styles.point} key={point.title}>
          <h2 className={styles.pointTitle}>{point.title}</h2>
          <p className={styles.pointCopy}>{point.copy}</p>
        </li>
      ))}
    </ul>
  </section>
);
