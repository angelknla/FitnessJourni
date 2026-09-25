import { ArrowLeftIcon } from '@components/Icons/Icons';
import { Landing } from '@components/Landing/Landing';
import { MessageBoard } from '@components/MessageBoard/MessageBoard';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getMembers } from '@/lib/data/members';
import { getMessages } from '@/lib/data/messages';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

export const metadata: Metadata = {
    title: 'Chat — FitnessJourni',
    description: 'Motivation and updates shared with the group',
};

export const dynamic = 'force-dynamic';

const MessagesPage = async () => {
    if (!(await isUnlocked())) {
        return <Landing />;
    }

    if (!isSupabaseConfigured()) {
        return <SetupNotice />;
    }

    const [members, messages, viewer] = await Promise.all([
        getMembers(),
        getMessages(),
        readViewer(),
    ]);

    return (
        <div className={styles.page}>
            <Link href="/" className={styles.back}>
                <ArrowLeftIcon />
                Home
            </Link>

            <header className={styles.head}>
                <p className={styles.eyebrow}>Chat</p>
                <h1 className={styles.title}>A little momentum goes a long way</h1>
            </header>

            <MessageBoard
                members={viewerFirst(members, viewer.memberId)}
                messages={messages}
                viewerId={viewer.memberId}
            />
        </div>
    );
};

export default MessagesPage;