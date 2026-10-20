'use client';

import { useEffect, useRef } from 'react';
import { useOptimisticSave } from '@hooks/useOptimisticSave';
import type { Member, MemberProfile, WeightMeasurement } from '@/types/fitness';
import type { MemberAccount } from '@/lib/data/accounts';

interface ProfileData {
  member: Member | null;
  profile: MemberProfile | null;
  measurements: WeightMeasurement[];
  account: MemberAccount | null;
}

export interface ProfileChange {
  member?: Partial<Member>;
  profile?: Partial<MemberProfile>;
  measurement?: WeightMeasurement;
  email?: string;
}

const applyChange = (data: ProfileData, change: ProfileChange): ProfileData => ({
  member: data.member ? { ...data.member, ...change.member } : null,
  profile: data.profile ? { ...data.profile, ...change.profile } : null,
  account: data.account && change.email ? { ...data.account, email: change.email } : data.account,
  measurements: change.measurement
    ? [
        ...data.measurements.filter((row) => row.date !== change.measurement?.date),
        change.measurement,
      ].sort((a, b) => a.date.localeCompare(b.date))
    : data.measurements,
});

export const useProfileUpdates = (base: ProfileData, scope: string) => {
  const updates = useOptimisticSave(base, scope, applyChange);
  const urls = useRef(new Set<string>());
  const preview = (file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  };
  useEffect(() => {
    const active = new Set(
      updates.statuses.map((entry) => entry.request.change.member?.avatarPath)
    );
    for (const url of urls.current) {
      if (!active.has(url)) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
  }, [updates.statuses]);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    []
  );
  return { ...updates, preview };
};
