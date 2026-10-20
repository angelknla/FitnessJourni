import styles from './RouteLoading.module.css';

export const RouteLoading = () => (
  <div className={styles.loading} role="status" aria-label="Loading page" aria-busy="true">
    <div className={styles.heading} aria-hidden="true">
      <span className={styles.eyebrow} />
      <span className={styles.title} />
    </div>
    <div className={styles.content} aria-hidden="true">
      <span className={styles.block} />
      <span className={styles.block} />
    </div>
    <div className={styles.rows} aria-hidden="true">
      <span className={styles.row} />
      <span className={styles.row} />
      <span className={styles.row} />
    </div>
  </div>
);
