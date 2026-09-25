import { progressionRules, sessionStructure, workoutBundles } from '@data/workoutPlanData';

import styles from './WorkoutPlan.module.css';

/**
 * The playbook's four lifting sessions. Read-only: this is the plan, and the
 * sets, rest and cues are transcribed as written rather than paraphrased.
 */
export const WorkoutPlan = () => (
  <div className={styles.plan}>
    {workoutBundles.map((bundle) => (
      <details className={styles.bundle} key={bundle.focus}>
        <summary className={styles.summary}>
          <span className={styles.summaryMain}>
            <span className={styles.day}>{bundle.day}</span>
            <span className={styles.title}>{bundle.title}</span>
          </span>
          <span className={styles.count}>{bundle.exercises.length} exercises</span>
        </summary>

        <p className={styles.blurb}>{bundle.summary}</p>

        <ul className={styles.exercises}>
          {bundle.exercises.map((exercise) => (
            <li className={styles.exercise} key={exercise.name}>
              <p className={styles.exerciseName}>{exercise.name}</p>
              <p className={styles.exerciseMeta}>
                <span className={styles.sets}>{exercise.sets}</span>
                <span className={styles.rest}>{exercise.rest} rest</span>
              </p>
              <p className={styles.cue}>{exercise.cue}</p>
            </li>
          ))}
        </ul>
      </details>
    ))}

    <details className={styles.bundle}>
      <summary className={styles.summary}>
        <span className={styles.summaryMain}>
          <span className={styles.day}>Every session</span>
          <span className={styles.title}>The 60-minute shape</span>
        </span>
      </summary>

      <ul className={styles.structure}>
        {sessionStructure.map((slot) => (
          <li className={styles.slot} key={slot.window}>
            <span className={styles.window}>{slot.window}</span>
            <span className={styles.action}>{slot.action}</span>
          </li>
        ))}
      </ul>

      <p className={styles.rulesHeading}>How to progress</p>
      <ul className={styles.rules}>
        {progressionRules.map((rule) => (
          <li className={styles.rule} key={rule}>
            {rule}
          </li>
        ))}
      </ul>
    </details>
  </div>
);
