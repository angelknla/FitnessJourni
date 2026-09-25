'use client';

import { IdentityDialog, type IdentityOption } from '@components/IdentityDialog/IdentityDialog';
import { useCallback, useState } from 'react';
import type { Member } from '@/types/fitness';
import { MemberCreateForm, type MemberCreateOption } from './MemberCreateForm';

interface AddMemberFormProps {
  members: Member[];
  /** Who is adding, so the prompt afterwards can say what staying means. */
  viewerId: string | null;
}

export const AddMemberForm = ({ members, viewerId }: AddMemberFormProps) => {
  const [created, setCreated] = useState<MemberCreateOption | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const handleMemberAdded = useCallback((member: MemberCreateOption) => setCreated(member), []);
  const prompted = created && created.id !== dismissed ? created : null;
  const options: IdentityOption[] =
    prompted && !members.some((member) => member.id === prompted.id)
      ? [...members, prompted]
      : members;

  return (
    <>
      <MemberCreateForm members={members} onMemberAdded={handleMemberAdded} />

      {prompted && (
        <IdentityDialog
          members={options}
          viewerId={viewerId}
          presetId={prompted.id}
          open
          onClose={() => setDismissed(prompted.id)}
          title={`${prompted.name} is in`}
          body={`Carry on as you are, or start logging as ${prompted.name}.`}
          dismissLabel="Stay as I am"
          submitLabel={`Log in as ${prompted.name}`}
        />
      )}
    </>
  );
};
