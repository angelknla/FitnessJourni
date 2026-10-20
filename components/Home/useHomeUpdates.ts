'use client';

import { useOptimisticSave } from '@hooks/useOptimisticSave';
import type { DailyLog, Member, MemberTargets, Workout } from '@/types/fitness';

interface HomeData {
  members: Member[];
  logs: Record<string, DailyLog>;
  workouts: Workout[];
  medalLogs: DailyLog[];
}

export type HomeChange =
  | { type: 'log'; memberId: string; date: string; patch: Partial<DailyLog> }
  | { type: 'targets'; memberId: string; patch: Partial<MemberTargets> }
  | { type: 'addWorkout'; workout: Workout; existingIds: string[] }
  | { type: 'deleteWorkout'; id: string };

const applyChange = (data: HomeData, change: HomeChange): HomeData => {
  switch (change.type) {
    case 'log': {
      const previous = data.logs[change.memberId] ?? {
        memberId: change.memberId,
        date: change.date,
        steps: 0,
        waterMl: 0,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        sleepHours: null,
      };
      const log = { ...previous, ...change.patch };
      const otherLogs = data.medalLogs.filter(
        (row) => row.memberId !== change.memberId || row.date !== change.date
      );
      return {
        ...data,
        logs: { ...data.logs, [change.memberId]: log },
        medalLogs: [...otherLogs, log],
      };
    }
    case 'targets':
      return {
        ...data,
        members: data.members.map((member) =>
          member.id === change.memberId
            ? { ...member, targets: { ...member.targets, ...change.patch } }
            : member
        ),
      };
    case 'addWorkout': {
      // The refreshed server row may arrive before the action finishes. Rebase
      // without showing both the temporary row and its confirmed counterpart.
      const confirmed = data.workouts.some(
        (workout) =>
          !change.existingIds.includes(workout.id) &&
          !workout.id.startsWith('optimistic:') &&
          workout.memberId === change.workout.memberId &&
          workout.date === change.workout.date &&
          workout.note === change.workout.note &&
          workout.focuses.join(',') === change.workout.focuses.join(',')
      );
      return confirmed ? data : { ...data, workouts: [...data.workouts, change.workout] };
    }
    case 'deleteWorkout':
      return { ...data, workouts: data.workouts.filter((workout) => workout.id !== change.id) };
  }
};

export const useHomeUpdates = (base: HomeData, scope: string) =>
  useOptimisticSave(base, scope, applyChange);
