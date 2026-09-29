'use client';

import {
  BinIcon,
  ChevronRightIcon,
  CrossIcon,
  GroupIcon,
  PencilIcon,
  SwitchIcon,
} from '@components/Icons/Icons';
import { avatarUploadTypes } from '@data/avatarData';
import { replaceInputFile, shrinkImage } from '@utils/image';
import Image from 'next/image';
import { useActionState, useEffect, useState } from 'react';
import {
  changeGroupMemberRole,
  createGroup,
  deleteGroup,
  type GroupActionState,
  inviteMemberByUsername,
  leaveGroup,
  regenerateGroupCode,
  removeGroupMember,
  requestGroupAccess,
  respondToInvitation,
  reviewJoinRequest,
  saveGroupImage,
  switchActiveGroup,
  transferGroupOwnership,
  updateGroupDetails,
} from '@/app/group-actions';
import {
  canDeleteGroup,
  canDemoteToMember,
  canEditGroupDetails,
  canInviteMembers,
  canLeaveGroup,
  canPromoteToAdmin,
  canRegenerateJoinCode,
  canRemoveGroupMember,
  canReviewJoinRequests,
  canTransferOwnership,
  compareByRole,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  roleLabels,
} from '@/lib/groups';
import type {
  FitnessGroup,
  GroupInvitation,
  GroupJoinRequest,
  GroupMemberRole,
  GroupMembership,
  Member,
} from '@/types/fitness';

import styles from './GroupsPanel.module.css';

/** One group the viewer belongs to, with everything its own section needs. */
export interface GroupDetail {
  membership: GroupMembership;
  members: GroupMemberRole[];
  /** Waiting on the viewer in this group; empty unless they manage it. */
  pendingRequests: GroupJoinRequest[];
}

/**
 * Everything the page needs, gathered on the server. One prop rather than five,
 * because they are only ever fetched and passed together.
 */
export interface GroupsData {
  groups: GroupDetail[];
  /** Null means Personal mode. */
  activeGroupId: string | null;
  /** Addressed to the viewer, awaiting their answer. */
  invitations: GroupInvitation[];
  /** The viewer's own asks, answered ones included. */
  requests: GroupJoinRequest[];
}

interface GroupsPanelProps extends GroupsData {
  /** Everyone, so a member id can be given a name. */
  members: Member[];
  viewerId: string;
}

const initial: GroupActionState = { ok: false };

const requestStatusLabels: Record<GroupJoinRequest['status'], string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Not approved',
  cancelled: 'No longer needed',
};

/**
 * Grows a textarea to fit its content, so a description that is already three
 * lines long is not shown through a two-line window.
 *
 * Done in JS rather than with `field-sizing: content`, which Firefox does not
 * support yet — this is the field where an existing value is being edited, so it
 * has to be right on first paint, not just while typing.
 */
const autoGrow = (element: HTMLTextAreaElement | null) => {
  if (!element) {
    return;
  }

  element.style.height = 'auto';
  /*
   * scrollHeight covers the content and its padding but not the border, and these
   * fields are border-box — so assigning scrollHeight alone leaves the last line
   * clipped by exactly the border width. offsetHeight - clientHeight is that
   * border.
   */
  const border = element.offsetHeight - element.clientHeight;
  element.style.height = `${element.scrollHeight + border}px`;
};

/** The group's picture, or the two-figure icon when it has none. */
const GroupPicture = ({ group }: { group: FitnessGroup }) =>
  group.imagePath ? (
    <Image
      src={group.imagePath}
      alt={`${group.name} group picture`}
      /* Drawn at up to 112px, so a 3x phone wants ~336 device pixels. These are
         the size Next matches a variant against, not the size it is shown at. */
      width={336}
      height={336}
      unoptimized={group.imagePath.startsWith('http://')}
    />
  ) : (
    <GroupIcon size={34} />
  );

/** One shared status line per block, so a refusal appears next to what caused it. */
const Status = ({ state }: { state: GroupActionState }) =>
  state.error || state.message ? (
    <p className={state.error ? styles.error : styles.success} role="status">
      {state.error ?? state.message}
    </p>
  ) : null;

export const GroupsPanel = ({
  groups,
  activeGroupId,
  invitations,
  requests,
  members,
  viewerId,
}: GroupsPanelProps) => {
  const [switchState, switchAction, switching] = useActionState(switchActiveGroup, initial);
  const [createState, createAction, creating] = useActionState(createGroup, initial);
  const [joinState, joinAction, joining] = useActionState(requestGroupAccess, initial);
  const [detailsState, detailsAction, savingDetails] = useActionState(updateGroupDetails, initial);
  const [inviteState, inviteAction, inviting] = useActionState(inviteMemberByUsername, initial);
  const [invitationState, invitationAction, answering] = useActionState(
    respondToInvitation,
    initial
  );
  const [reviewState, reviewAction, reviewing] = useActionState(reviewJoinRequest, initial);
  const [roleState, roleAction, changingRole] = useActionState(changeGroupMemberRole, initial);
  const [transferState, transferAction, transferring] = useActionState(
    transferGroupOwnership,
    initial
  );
  const [removeState, removeAction, removing] = useActionState(removeGroupMember, initial);
  const [leaveState, leaveAction, leaving] = useActionState(leaveGroup, initial);
  const [codeState, codeAction, regenerating] = useActionState(regenerateGroupCode, initial);
  const [imageState, imageAction, savingImage] = useActionState(saveGroupImage, initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteGroup, initial);

  /* The current group is open to begin with; the rest are collapsed. */
  const [openGroupIds, setOpenGroupIds] = useState<string[]>(activeGroupId ? [activeGroupId] : []);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showSettingsFor, setShowSettingsFor] = useState<string | null>(null);
  const [showInviteFor, setShowInviteFor] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (createState.ok) setShowCreate(false);
    if (joinState.ok) setShowJoin(false);
  }, [createState.ok, joinState.ok]);

  /*
   * Every action that can be armed by a confirm step, rolled into one value. Each
   * one stamps bookedAt on success, so this changes exactly when one completes.
   */
  const lastCompletedAction = [
    roleState.bookedAt,
    transferState.bookedAt,
    removeState.bookedAt,
    codeState.bookedAt,
    leaveState.bookedAt,
    deleteState.bookedAt,
  ].join('|');

  useEffect(() => {
    /*
     * Disarm once the action has actually run. Deliberately NOT done from the
     * submit button's onClick: that re-render unmounts the form the button belongs
     * to before the submission is dispatched, and the action never fires at all.
     */
    void lastCompletedAction;
    setConfirming(null);
    setDeleteConfirm('');
  }, [lastCompletedAction]);

  const nameOf = (memberId: string) =>
    members.find((member) => member.id === memberId)?.name ?? 'Someone';

  const toggleGroup = (groupId: string) =>
    setOpenGroupIds((open) =>
      open.includes(groupId) ? open.filter((id) => id !== groupId) : [...open, groupId]
    );

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // No clipboard permission: the code is on screen to read anyway.
    }
  };

  const busy =
    switching || answering || changingRole || transferring || removing || leaving || deleting;

  return (
    <div className={styles.groups}>
      {/* ---- Invitations: actionable, and not about any one group ------------ */}
      {invitations.length > 0 && (
        <section className={styles.block} aria-labelledby="invitations-heading">
          <h2 id="invitations-heading">Invitations</h2>
          <ul className={styles.rows}>
            {invitations.map((invitation) => (
              <li key={invitation.id} className={styles.row}>
                <div className={styles.rowText}>
                  <strong>{invitation.groupName}</strong>
                  <small>
                    {invitation.invitedBy
                      ? `Invited by ${nameOf(invitation.invitedBy)}`
                      : 'You have been invited'}
                  </small>
                </div>
                <div className={styles.rowActions}>
                  <form action={invitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <input type="hidden" name="response" value="accept" />
                    <button type="submit" className={styles.primary} disabled={answering}>
                      Accept
                    </button>
                  </form>
                  <form action={invitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <input type="hidden" name="response" value="decline" />
                    <button type="submit" className={styles.quiet} disabled={answering}>
                      Decline
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <Status state={invitationState} />
        </section>
      )}

      {/* ---- One collapsible section per group ------------------------------ */}
      {groups.length === 0 ? (
        <section className={styles.block}>
          <h2>Personal</h2>
          <p className={styles.empty}>
            You are logging privately. Nothing you record is shared with anyone until you join a
            group or create one — and joining never reveals what you logged beforehand.
          </p>
        </section>
      ) : (
        <ul className={styles.groupList}>
          {groups.map(({ membership, members: groupMembers, pendingRequests }) => {
            const { group, role } = membership;
            const current = group.id === activeGroupId;
            const open = openGroupIds.includes(group.id);
            const people = groupMembers
              .map((groupMember) => ({ ...groupMember, name: nameOf(groupMember.memberId) }))
              .sort(compareByRole);

            return (
              <li key={group.id} className={styles.group} data-current={current || undefined}>
                <h2 className={styles.groupHeading}>
                  <button
                    type="button"
                    className={styles.groupToggle}
                    aria-expanded={open}
                    aria-controls={`group-${group.id}`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span className={styles.chevron} data-open={open || undefined}>
                      <ChevronRightIcon size={14} />
                    </span>
                    <GroupIcon size={15} />
                    <span className={styles.groupName}>{group.name}</span>
                    {current && <span className={styles.currentChip}>Current</span>}
                    <span className={styles.groupMeta}>
                      {group.memberCount === 1 ? '1 member' : `${group.memberCount} members`}
                    </span>
                  </button>
                </h2>

                <div id={`group-${group.id}`} className={styles.groupBody} hidden={!open}>
                  {/* Picture and description share the width; the icon stands in
                      for a group that has no picture. */}
                  <div className={styles.info}>
                    {canEditGroupDetails(role) ? (
                      /*
                       * The picture is its own uploader: the label opens the file
                       * dialog, and choosing a file submits immediately, so the
                       * quick path is one tap and a pick. The fuller control — with
                       * Remove — still lives in Group settings below.
                       */
                      <form action={imageAction} className={styles.infoPicture}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <input
                          id={`picture-${group.id}`}
                          className={styles.pictureInput}
                          type="file"
                          name="image"
                          accept={avatarUploadTypes.join(',')}
                          aria-label={`Change ${group.name} group picture`}
                          onChange={async (event) => {
                            const input = event.currentTarget;
                            const chosen = input.files?.[0];
                            if (!chosen) return;
                            // Shrunk first, so the form posts the small version.
                            replaceInputFile(input, await shrinkImage(chosen));
                            input.form?.requestSubmit();
                          }}
                        />
                        {/* A label rather than a button: it opens the native file
                            dialog without any script of ours. */}
                        <label
                          htmlFor={`picture-${group.id}`}
                          className={`${styles.infoImage} ${styles.infoImageButton}`}
                          title="Change group picture"
                        >
                          <GroupPicture group={group} />
                        </label>
                        <span className={styles.editPicture} aria-hidden="true">
                          <PencilIcon size={11} />
                        </span>
                      </form>
                    ) : (
                      <div className={styles.infoPicture}>
                        <div className={styles.infoImage}>
                          <GroupPicture group={group} />
                        </div>
                      </div>
                    )}
                    <p className={styles.description}>
                      {group.description || (
                        <span className={styles.noDescription}>No description yet.</span>
                      )}
                    </p>
                  </div>

                  {savingImage ? (
                    <p className={styles.hint} role="status">
                      Saving picture…
                    </p>
                  ) : (
                    <Status state={imageState} />
                  )}

                  {!current && (
                    <form action={switchAction} className={styles.inlineForm}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <button type="submit" className={styles.primary} disabled={switching}>
                        <SwitchIcon />
                        Switch to {group.name}
                      </button>
                      <span className={styles.hint}>
                        Changes whose logs, chat and sessions you see everywhere.
                      </span>
                    </form>
                  )}

                  {/* ---- Requests waiting on a manager of this group -------- */}
                  {canReviewJoinRequests(role) && pendingRequests.length > 0 && (
                    <div className={styles.section}>
                      <h3>Requests to join</h3>
                      <ul className={styles.rows}>
                        {pendingRequests.map((request) => (
                          <li key={request.id} className={styles.row}>
                            <div className={styles.rowText}>
                              <strong>{nameOf(request.memberId)}</strong>
                              <small>wants to join</small>
                            </div>
                            <div className={styles.rowActions}>
                              <form action={reviewAction}>
                                <input type="hidden" name="requestId" value={request.id} />
                                <input type="hidden" name="decision" value="approve" />
                                <button
                                  type="submit"
                                  className={styles.primary}
                                  disabled={reviewing}
                                >
                                  Approve
                                </button>
                              </form>
                              <form action={reviewAction}>
                                <input type="hidden" name="requestId" value={request.id} />
                                <input type="hidden" name="decision" value="reject" />
                                <button type="submit" className={styles.quiet} disabled={reviewing}>
                                  Reject
                                </button>
                              </form>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <Status state={reviewState} />
                    </div>
                  )}

                  {/* ---- Members and their roles ---------------------------- */}
                  <div className={styles.section}>
                    <h3>Members</h3>
                    <ul className={styles.rows}>
                      {people.map((person) => {
                        const isSelf = person.memberId === viewerId;
                        const removeKey = `remove:${group.id}:${person.memberId}`;
                        const transferKey = `transfer:${group.id}:${person.memberId}`;

                        return (
                          <li key={person.memberId} className={styles.row}>
                            <div className={styles.rowText}>
                              <strong>
                                {person.name}
                                {isSelf && <span className={styles.you}>you</span>}
                              </strong>
                              <small>{roleLabels[person.role]}</small>
                            </div>
                            <div className={styles.rowActions}>
                              {canPromoteToAdmin(role, person.role) && (
                                <form action={roleAction}>
                                  <input type="hidden" name="groupId" value={group.id} />
                                  <input type="hidden" name="memberId" value={person.memberId} />
                                  <input type="hidden" name="role" value="admin" />
                                  <button
                                    type="submit"
                                    className={styles.quiet}
                                    disabled={changingRole}
                                  >
                                    Make admin
                                  </button>
                                </form>
                              )}
                              {canDemoteToMember(role, person.role) && (
                                <form action={roleAction}>
                                  <input type="hidden" name="groupId" value={group.id} />
                                  <input type="hidden" name="memberId" value={person.memberId} />
                                  <input type="hidden" name="role" value="member" />
                                  <button
                                    type="submit"
                                    className={styles.quiet}
                                    disabled={changingRole}
                                  >
                                    Remove admin
                                  </button>
                                </form>
                              )}
                              {canTransferOwnership(role) &&
                                !isSelf &&
                                (confirming === transferKey ? (
                                  <form action={transferAction}>
                                    <input type="hidden" name="groupId" value={group.id} />
                                    <input type="hidden" name="memberId" value={person.memberId} />
                                    <button
                                      type="submit"
                                      className={styles.danger}
                                      disabled={transferring}
                                    >
                                      Confirm handover
                                    </button>
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    className={styles.quiet}
                                    onClick={() => setConfirming(transferKey)}
                                    disabled={busy}
                                  >
                                    Make owner
                                  </button>
                                ))}
                              {canRemoveGroupMember(role, person.role, isSelf) &&
                                (confirming === removeKey ? (
                                  <form action={removeAction}>
                                    <input type="hidden" name="groupId" value={group.id} />
                                    <input type="hidden" name="memberId" value={person.memberId} />
                                    <button
                                      type="submit"
                                      className={styles.danger}
                                      disabled={removing}
                                      aria-label={`Confirm removing ${person.name}`}
                                    >
                                      Confirm
                                    </button>
                                  </form>
                                ) : (
                                  /*
                                   * Icon-only: three worded actions do not fit one row
                                   * on a 360px phone. The name is in the label, which
                                   * also tells a screen reader which row it belongs to.
                                   */
                                  <button
                                    type="button"
                                    className={`${styles.quiet} ${styles.iconOnly}`}
                                    onClick={() => setConfirming(removeKey)}
                                    disabled={busy}
                                    aria-label={`Remove ${person.name}`}
                                    title={`Remove ${person.name}`}
                                  >
                                    <BinIcon size={14} />
                                  </button>
                                ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Status state={roleState} />
                    <Status state={transferState} />
                    <Status state={removeState} />
                  </div>

                  {/* ---- The code, which is how people ask to join ---------- */}
                  <div className={styles.section}>
                    <h3>Group code</h3>
                    <div className={styles.codeRow}>
                      <code className={styles.code}>
                        {codeState.joinCode && current ? codeState.joinCode : group.joinCode}
                      </code>
                      <button
                        type="button"
                        className={styles.quiet}
                        onClick={() => copyCode(group.joinCode)}
                      >
                        {copiedCode === group.joinCode ? 'Copied' : 'Copy'}
                      </button>
                      {canRegenerateJoinCode(role) &&
                        (confirming === `code:${group.id}` ? (
                          <form action={codeAction}>
                            <input type="hidden" name="groupId" value={group.id} />
                            <button type="submit" className={styles.danger} disabled={regenerating}>
                              Confirm new code
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className={styles.quiet}
                            onClick={() => setConfirming(`code:${group.id}`)}
                            disabled={busy}
                          >
                            New code
                          </button>
                        ))}
                    </div>
                    <p className={styles.hint}>
                      Anyone with this code can ask to join. A new code stops the old one working
                      immediately.
                    </p>
                    <Status state={codeState} />
                  </div>

                  {/* ---- Details and invitations ---------------------------- */}
                  {canEditGroupDetails(role) && (
                    <div className={styles.section}>
                      {/* Two equal ways to manage the group; one panel at a time. */}
                      <div className={styles.triggerRow}>
                        <button
                          type="button"
                          className={styles.panelTrigger}
                          aria-expanded={showSettingsFor === group.id}
                          aria-controls={`settings-${group.id}`}
                          onClick={() => {
                            setShowSettingsFor((open) => (open === group.id ? null : group.id));
                            setShowInviteFor(null);
                          }}
                        >
                          Group settings
                        </button>
                        {canInviteMembers(role) && (
                          <button
                            type="button"
                            className={styles.panelTrigger}
                            aria-expanded={showInviteFor === group.id}
                            aria-controls={`invite-${group.id}`}
                            onClick={() => {
                              setShowInviteFor((open) => (open === group.id ? null : group.id));
                              setShowSettingsFor(null);
                            }}
                          >
                            Invite a user
                          </button>
                        )}
                      </div>

                      {/*
                       * The picture is its own form: it posts a file, and keeping it
                       * apart means saving the name does not re-upload the image and
                       * a failed upload does not lose typed text.
                       */}

                      {showSettingsFor === group.id && (
                        <form
                          id={`settings-${group.id}`}
                          action={detailsAction}
                          className={styles.panel}
                        >
                          <div className={styles.panelHead}>
                            <h3>Group settings</h3>
                            <button
                              type="button"
                              className={styles.panelClose}
                              aria-label="Close group settings"
                              onClick={() => setShowSettingsFor(null)}
                            >
                              <CrossIcon size={14} />
                            </button>
                          </div>
                          <input type="hidden" name="groupId" value={group.id} />
                          <label>
                            <span>Group name</span>
                            <input
                              name="name"
                              defaultValue={group.name}
                              maxLength={GROUP_NAME_MAX}
                              required
                            />
                          </label>
                          <label>
                            <span>Description</span>
                            <textarea
                              ref={autoGrow}
                              name="description"
                              defaultValue={group.description ?? ''}
                              maxLength={GROUP_DESCRIPTION_MAX}
                              rows={2}
                              onInput={(event) => autoGrow(event.currentTarget)}
                            />
                          </label>
                          <button type="submit" className={styles.primary} disabled={savingDetails}>
                            {savingDetails ? 'Saving…' : 'Save details'}
                          </button>
                          <Status state={detailsState} />
                        </form>
                      )}
                      {showSettingsFor === group.id && (
                        <form action={imageAction} className={styles.panel}>
                          <div className={styles.panelHead}>
                            <h3>Group picture</h3>
                          </div>
                          <input type="hidden" name="groupId" value={group.id} />
                          <div className={styles.pictureRow}>
                            <div className={styles.picturePreview}>
                              {group.imagePath ? (
                                <Image
                                  src={group.imagePath}
                                  alt=""
                                  width={192}
                                  height={192}
                                  unoptimized={group.imagePath.startsWith('http://')}
                                />
                              ) : (
                                <GroupIcon size={26} />
                              )}
                            </div>
                            <div className={styles.pictureControls}>
                              <label className={styles.fileLabel}>
                                <span>Choose an image</span>
                                <input
                                  type="file"
                                  name="image"
                                  accept={avatarUploadTypes.join(',')}
                                  onChange={async (event) => {
                                    const input = event.currentTarget;
                                    const chosen = input.files?.[0];
                                    if (chosen) {
                                      replaceInputFile(input, await shrinkImage(chosen));
                                    }
                                  }}
                                />
                              </label>
                              <div className={styles.pictureActions}>
                                <button
                                  type="submit"
                                  className={styles.primary}
                                  disabled={savingImage}
                                >
                                  {savingImage ? 'Saving…' : 'Save picture'}
                                </button>
                                {group.imagePath && (
                                  <button
                                    type="submit"
                                    name="remove"
                                    value="true"
                                    className={styles.quiet}
                                    disabled={savingImage}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className={styles.hint}>
                            JPEG, PNG or WebP up to 5 MB. Without one, the group shows the
                            two-figure icon. Tapping the picture above uploads straight away.
                          </p>
                        </form>
                      )}

                      {showInviteFor === group.id && (
                        <form
                          id={`invite-${group.id}`}
                          action={inviteAction}
                          className={styles.panel}
                        >
                          <div className={styles.panelHead}>
                            <h3>Invite a user</h3>
                            <button
                              type="button"
                              className={styles.panelClose}
                              aria-label="Close invite a user"
                              onClick={() => setShowInviteFor(null)}
                            >
                              <CrossIcon size={14} />
                            </button>
                          </div>
                          <input type="hidden" name="groupId" value={group.id} />
                          <label>
                            <span>Username</span>
                            <input
                              name="username"
                              autoComplete="off"
                              placeholder="username"
                              required
                            />
                          </label>
                          <button type="submit" className={styles.primary} disabled={inviting}>
                            {inviting ? 'Inviting…' : 'Send invitation'}
                          </button>
                          <p className={styles.hint}>
                            They choose whether to accept. Nobody is added to a group without
                            agreeing.
                          </p>
                          <Status state={inviteState} />
                        </form>
                      )}
                    </div>
                  )}

                  {/* ---- Leaving and deleting ------------------------------- */}
                  <div className={styles.section}>
                    <h3>Leaving</h3>
                    {canLeaveGroup(role) ? (
                      confirming === `leave:${group.id}` ? (
                        <form action={leaveAction} className={styles.inlineForm}>
                          <input type="hidden" name="groupId" value={group.id} />
                          <button type="submit" className={styles.danger} disabled={leaving}>
                            Confirm leave {group.name}
                          </button>
                          <button type="button" className={styles.quiet}>
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className={styles.quiet}
                          onClick={() => setConfirming(`leave:${group.id}`)}
                          disabled={busy}
                        >
                          Leave {group.name}
                        </button>
                      )
                    ) : (
                      <p className={styles.hint}>
                        As the owner you cannot leave. Hand the group to someone else first, or
                        delete it.
                      </p>
                    )}
                    <Status state={leaveState} />

                    {canDeleteGroup(role) && (
                      <form action={deleteAction} className={styles.form}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <label>
                          <span>Delete this group — type “{group.name}” to confirm</span>
                          <input
                            name="confirm"
                            value={confirming === `delete:${group.id}` ? deleteConfirm : ''}
                            onChange={(event) => {
                              setConfirming(`delete:${group.id}`);
                              setDeleteConfirm(event.target.value);
                            }}
                            autoComplete="off"
                            placeholder={group.name}
                          />
                        </label>
                        <p className={styles.hint}>
                          The chat, the sessions and the group go for everyone. Personal logs,
                          workouts and runs are kept — they simply stop being shared here.
                        </p>
                        <button
                          type="submit"
                          className={styles.danger}
                          disabled={
                            deleting ||
                            confirming !== `delete:${group.id}` ||
                            deleteConfirm.trim().toLowerCase() !== group.name.toLowerCase()
                          }
                        >
                          {deleting ? 'Deleting…' : 'Delete group'}
                        </button>
                        <Status state={deleteState} />
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Status state={switchState} />

      {/* ---- The viewer's own outstanding asks ------------------------------ */}
      {requests.length > 0 && (
        <section className={styles.block} aria-labelledby="requests-heading">
          <h2 id="requests-heading">Your requests</h2>
          <ul className={styles.rows}>
            {requests.map((request) => (
              <li key={request.id} className={styles.row}>
                <div className={styles.rowText}>
                  <strong>{request.groupName}</strong>
                  <small>{requestStatusLabels[request.status]}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Below every group, because neither belongs to one of them ------ */}
      <section className={styles.block} aria-labelledby="another-heading">
        <h2 id="another-heading">Another group</h2>

        {/* Side by side and equal, as neither is the primary way in. Whichever is
            open shows below the pair — only ever one of them. */}
        <div className={styles.triggerRow}>
          <button
            type="button"
            className={styles.panelTrigger}
            aria-expanded={showCreate}
            aria-controls="create-group"
            onClick={() => {
              setShowCreate((open) => !open);
              setShowJoin(false);
            }}
          >
            Create a group
          </button>
          <button
            type="button"
            className={styles.panelTrigger}
            aria-expanded={showJoin}
            aria-controls="join-group"
            onClick={() => {
              setShowJoin((open) => !open);
              setShowCreate(false);
            }}
          >
            Join a group
          </button>
        </div>

        {showCreate && (
          <form id="create-group" action={createAction} className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Create a group</h3>
              <button
                type="button"
                className={styles.panelClose}
                aria-label="Close create a group"
                onClick={() => setShowCreate(false)}
              >
                <CrossIcon size={14} />
              </button>
            </div>
            <label>
              <span>Group name</span>
              <input name="name" maxLength={GROUP_NAME_MAX} placeholder="Nine Elms" required />
            </label>
            <label>
              <span>Description (optional)</span>
              <textarea
                ref={autoGrow}
                name="description"
                maxLength={GROUP_DESCRIPTION_MAX}
                rows={2}
                onInput={(event) => autoGrow(event.currentTarget)}
              />
            </label>
            <button type="submit" className={styles.primary} disabled={creating}>
              {creating ? 'Creating…' : 'Create group'}
            </button>
            <p className={styles.hint}>You become its owner, and it becomes your current group.</p>
          </form>
        )}

        {showJoin && (
          <form id="join-group" action={joinAction} className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Join a group</h3>
              <button
                type="button"
                className={styles.panelClose}
                aria-label="Close join a group"
                onClick={() => setShowJoin(false)}
              >
                <CrossIcon size={14} />
              </button>
            </div>
            <label>
              <span>Group code</span>
              <input
                name="joinCode"
                placeholder="N7K4-P2Q9"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </label>
            <button type="submit" className={styles.primary} disabled={joining}>
              {joining ? 'Asking…' : 'Ask to join'}
            </button>
            <p className={styles.hint}>
              An owner or admin has to approve you. Entering a code never joins you outright.
            </p>
          </form>
        )}

        {/*
         * Outside both panels on purpose: a success closes the panel it came from,
         * which would take the confirmation with it — and "asked to join" is the
         * only sign that anything happened.
         */}
        <Status state={createState} />
        <Status state={joinState} />
      </section>
    </div>
  );
};
