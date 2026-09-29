import { getSupabase } from '@/lib/supabase/server';
import type {
  MessagePost,
  MessageReaction,
  MessageReactionType,
  MessageReply,
} from '@/types/fitness';

export interface MessageRow {
  id: string;
  member_id: string;
  content: string;
  created_at: string;
  reply_to_id?: string | null;
}

export interface MessageReactionRow {
  message_id: string;
  member_id: string;
  reaction: string;
}

export const mapMessage = (
  row: MessageRow,
  reactions: MessageReaction[] = [],
  replyTo?: MessageReply
): MessagePost => ({
  id: row.id,
  memberId: row.member_id,
  content: row.content,
  createdAt: row.created_at,
  ...(replyTo ? { replyTo } : {}),
  reactions,
});

export const hasUnreadMessages = (
  latestMessageAt: string | null,
  lastReadAt: string | null
): boolean => Boolean(latestMessageAt && (!lastReadAt || latestMessageAt > lastReadAt));

/**
 * One group's chat. Messages belong to a group outright rather than being shared
 * with it, so this is a plain filter and Personal mode has no chat to read — the
 * caller passes null and gets nothing, with no query sent.
 */
export const getMessages = async (groupId: string | null): Promise<MessagePost[]> => {
  const supabase = getSupabase();
  if (!supabase || !groupId) {
    return [];
  }

  const messageResult = await supabase
    .from('messages')
    .select('id, member_id, content, created_at, reply_to_id')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(100);

  let data = messageResult.data as MessageRow[] | null;
  let error = messageResult.error;

  if (messageResult.error?.message.includes('reply_to_id')) {
    const legacyResult = await supabase
      .from('messages')
      .select('id, member_id, content, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(100);
    data = legacyResult.data as MessageRow[] | null;
    error = legacyResult.error;
  }

  if (error) {
    console.error('[messages] read failed:', error.message);
    return [];
  }

  const rows = data as MessageRow[];
  if (rows.length === 0) {
    return [];
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const missingReplyIds = [
    ...new Set(
      rows
        .map((row) => row.reply_to_id)
        .filter((id): id is string => Boolean(id) && !rowById.has(id as string))
    ),
  ];
  if (missingReplyIds.length > 0) {
    const { data: replyData, error: replyError } = await supabase
      .from('messages')
      .select('id, member_id, content, created_at, reply_to_id')
      .eq('group_id', groupId)
      .in('id', missingReplyIds);

    if (replyError) {
      console.error('[message replies] read failed:', replyError.message);
    } else {
      for (const row of replyData as MessageRow[]) rowById.set(row.id, row);
    }
  }

  const { data: reactionData, error: reactionError } = await supabase
    .from('message_reactions')
    .select('message_id, member_id, reaction')
    .in(
      'message_id',
      rows.map((row) => row.id)
    );

  if (reactionError) {
    console.error('[message reactions] read failed:', reactionError.message);
    return rows.map((row) => {
      const reply = row.reply_to_id ? rowById.get(row.reply_to_id) : undefined;
      return mapMessage(
        row,
        [],
        reply ? { id: reply.id, memberId: reply.member_id, content: reply.content } : undefined
      );
    });
  }

  const reactionsByMessage = new Map<string, MessageReaction[]>();
  for (const row of reactionData as MessageReactionRow[]) {
    const reactions = reactionsByMessage.get(row.message_id) ?? [];
    reactions.push({ memberId: row.member_id, type: row.reaction as MessageReactionType });
    reactionsByMessage.set(row.message_id, reactions);
  }

  return rows.map((row) => {
    const reply = row.reply_to_id ? rowById.get(row.reply_to_id) : undefined;
    return mapMessage(
      row,
      reactionsByMessage.get(row.id),
      reply ? { id: reply.id, memberId: reply.member_id, content: reply.content } : undefined
    );
  });
};

/**
 * Unread is per group: the cursor and the latest message are both read inside the
 * active group, so switching groups cannot carry a read state across and report
 * the wrong thing in either direction.
 */
export const getHasUnreadMessages = async (
  memberId: string,
  groupId: string | null
): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase || !groupId) {
    return false;
  }

  const [latestResult, readResult] = await Promise.all([
    supabase
      .from('messages')
      .select('created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('message_reads')
      .select('last_read_at')
      .eq('member_id', memberId)
      .eq('group_id', groupId)
      .maybeSingle(),
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
