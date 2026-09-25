import { Footer } from '@components/Footer/Footer';
import { Header } from '@components/Header/Header';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { isUnlocked } from '@/lib/session';
import type { LayoutProps } from '@/types/LayoutProps';

import '@/styles/globals.css';
import styles from './page.module.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FitnessJourni',
  description: 'Shared daily tracking and training sessions',
  icons: {
    icon: '/icon.svg',
  },
};

const RootLayout = async ({ children }: LayoutProps) => {
  /*
   * Only used to swap the nav for a Log in button. The gate itself lives in each
   * page, NOT here: Next renders the page concurrently with the layout, so a
   * layout that declines to render `children` does not stop the page executing —
   * its fetched data still lands in the RSC payload for anyone to read.
   */
  const locked = !(await isUnlocked());

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <div className={styles.appWrapper}>
          <Header locked={locked} />
          <main className={styles.content}>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
