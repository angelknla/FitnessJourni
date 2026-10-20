import styles from './SetupNotice.module.css';

/**
 * Shown when the Supabase URL or server key is missing. The app has to stay
 * runnable before the credentials exist, so this replaces a white screen.
 */
export const SetupNotice = () => (
  <section className={styles.notice}>
    <h2 className={styles.title}>Connect Supabase to start logging</h2>

    <p className={styles.body}>
      The app is running, but it has nowhere to read from or write to yet. Two steps:
    </p>

    <ol className={styles.steps}>
      <li>
        Run <code className={styles.code}>supabase/schema.sql</code> in your Supabase project's SQL
        editor. It creates the tables and adds the starting members.
      </li>
      <li>
        Create <code className={styles.code}>.env.local</code> in the project root with your project
        URL, <strong>secret</strong> key and app passcode, then restart the dev server:
        <pre className={styles.pre}>
          <code>
            {
              'SUPABASE_URL=https://xxxxx.supabase.co\nSUPABASE_SECRET_KEY=sb_secret_...\nAPP_PASSCODE=...'
            }
          </code>
        </pre>
      </li>
    </ol>

    <p className={styles.footnote}>
      There is deliberately no <code className={styles.code}>NEXT_PUBLIC_</code> prefix — that keeps
      the key on the server, so it is never sent to the browser.
    </p>
  </section>
);
