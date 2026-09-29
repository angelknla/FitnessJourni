/**
 * What a group-scoped read is allowed to return.
 *
 * Resolved on the server from an accepted membership and threaded through every
 * query that touches shared records, so "which group am I looking at" is decided
 * once per request instead of being re-guessed — or accepted from the browser —
 * at each call site.
 */
export interface DataScope {
  /**
   * The active group whose shared records are visible. Null is Personal mode,
   * where nothing of anyone else's exists.
   */
  groupId: string | null;
  /**
   * The signed-in member. They always see their own records, whichever group they
   * are looking at.
   */
  memberId: string | null;
}

export const PERSONAL_SCOPE: DataScope = { groupId: null, memberId: null };

/** Nothing to fetch at all: no group to read from and nobody to read as. */
export const isEmptyScope = (scope: DataScope): boolean =>
  scope.groupId === null && scope.memberId === null;
