import { getActiveGroup } from '@/lib/data/groups';
import type { DataScope } from '@/lib/data/scope';
import { readViewer, type Viewer } from '@/lib/session';
import type { ActiveGroup } from '@/types/fitness';

export interface ViewerContext {
  viewer: Viewer;
  /** Null means Personal mode: they belong to no group yet. */
  activeGroup: ActiveGroup | null;
  scope: DataScope;
}

/**
 * Who is asking, which group they are in, and therefore what they may read.
 *
 * Every page calls this once and threads the scope down. The group is resolved
 * from an accepted membership on each request rather than from anything the
 * browser sent, so a tampered form field or a stale link cannot widen it — and a
 * member removed a second ago is back in Personal mode on the next render.
 */
export const readViewerContext = async (): Promise<ViewerContext> => {
  const viewer = await readViewer();

  if (!viewer.memberId) {
    return { viewer, activeGroup: null, scope: { groupId: null, memberId: null } };
  }

  const activeGroup = await getActiveGroup(viewer.memberId);

  return {
    viewer,
    activeGroup,
    scope: { groupId: activeGroup?.id ?? null, memberId: viewer.memberId },
  };
};
