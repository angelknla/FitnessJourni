import { Footer } from '@components/Footer/Footer';
import { Header } from '@components/Header/Header';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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

const RootLayout = ({ children }: LayoutProps) => {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <div className={styles.appWrapper}>
          <Header />
          <main className={styles.content}>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
