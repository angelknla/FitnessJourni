/** Shared tags keep cached reads consistent across every page after a save. */
export const DATA_TAGS = {
  members: 'fitnessjourni:members',
  profile: 'fitnessjourni:profile',
  logs: 'fitnessjourni:logs',
  workouts: 'fitnessjourni:workouts',
  runs: 'fitnessjourni:runs',
  messages: 'fitnessjourni:messages',
  messageReads: 'fitnessjourni:message-reads',
  sessions: 'fitnessjourni:sessions',
  sessionReads: 'fitnessjourni:session-reads',
} as const;

export const READ_CACHE: Record<string, { tag: string; seconds: number }> = {
  members: { tag: DATA_TAGS.members, seconds: 300 },
  weight_measurements: { tag: DATA_TAGS.profile, seconds: 300 },
  daily_logs: { tag: DATA_TAGS.logs, seconds: 60 },
  workouts: { tag: DATA_TAGS.workouts, seconds: 60 },
  runs: { tag: DATA_TAGS.runs, seconds: 60 },
  messages: { tag: DATA_TAGS.messages, seconds: 15 },
  message_reactions: { tag: DATA_TAGS.messages, seconds: 15 },
  message_reads: { tag: DATA_TAGS.messageReads, seconds: 15 },
  sessions: { tag: DATA_TAGS.sessions, seconds: 30 },
  session_reads: { tag: DATA_TAGS.sessionReads, seconds: 30 },
};
