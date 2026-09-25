import { getSupabase } from '@/lib/supabase/server';
import type { MessagePost } from '@/types/fitness';

export interface MessageRow {
  id: string;
  member_id: string;
  content: string;
  created_at: string;
}

export const mapMessage = (row: MessageRow): MessagePost => ({
  id: row.id,
  memberId: row.member_id,
  content: row.content,
  createdAt: row.created_at,
});

export const hasUnreadMessages = (
  latestMessageAt: string | null,
  lastReadAt: string | null
): boolean => Boolean(latestMessageAt && (!lastReadAt || latestMessageAt > lastReadAt));

export const getMessages = async (): Promise<MessagePost[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, member_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[messages] read failed:', error.message);
    return [];
  }

  return (data as MessageRow[]).map(mapMessage);
};

export const getHasUnreadMessages = async (memberId: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  const [latestResult, readResult] = await Promise.all([
    supabase
      .from('messages')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('message_reads').select('last_read_at').eq('member_id', memberId).maybeSingle(),
  ]);

  if (latestResult.error || readResult.error) {
    console.error(
      '[messages] unread check failed:',
      latestResult.error?.message ?? readResult.error?.message
    );
    return false;
  }

  const latestMessageAt = latestResult.data?.[0]?.created_at as string | undefined;
  const lastReadAt = readResult.data?.last_read_at as string | undefined;
  return hasUnreadMessages(latestMessageAt ?? null, lastReadAt ?? null);
};
