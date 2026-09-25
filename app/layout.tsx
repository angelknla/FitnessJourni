import { Footer } from '@components/Footer/Footer';
import { Header } from '@components/Header/Header';
import { Landing } from '@components/Landing/Landing';
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
  // Locked visitors never reach the pages, so no data is fetched for them —
  // `children` is only evaluated if it is actually rendered.
  const locked = !(await isUnlocked());

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <div className={styles.appWrapper}>
          <Header locked={locked} />
          <main className={styles.content}>{locked ? <Landing /> : children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
