import { Landing } from '@components/Landing/Landing';
import { MessageBoard } from '@components/MessageBoard/MessageBoard';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { PersonalModeNotice } from '@components/PersonalModeNotice/PersonalModeNotice';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import type { Metadata } from 'next';
import { getScopedMembers } from '@/lib/data/members';
import { getMessages } from '@/lib/data/messages';
import { readViewerContext } from '@/lib/data/viewerScope';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked } from '@/lib/session';
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

  const { viewer, activeGroup, scope } = await readViewerContext();

  // Chat belongs to a group outright — there is no personal chat to fall back to.
  if (!activeGroup) {
    return (
      <PageLayout className={styles.page} data-page="chat">
        <PersonalModeNotice
          title="No group, no chat"
          description="Chat is shared with one group at a time. Join a group or create one to start talking."
        />
      </PageLayout>
    );
  }

  const [members, messages] = await Promise.all([
    getScopedMembers(scope),
    getMessages(activeGroup.id),
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
