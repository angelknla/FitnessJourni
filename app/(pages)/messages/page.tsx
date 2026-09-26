import { Landing } from '@components/Landing/Landing';
import { MessageBoard } from '@components/MessageBoard/MessageBoard';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import type { Metadata } from 'next';
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
        <PageLayout className={styles.page} data-page="chat">
            <MessageBoard
                members={viewerFirst(members, viewer.memberId)}
                messages={messages}
                viewerId={viewer.memberId}
            />
        </PageLayout>
    );
};

export default MessagesPage;