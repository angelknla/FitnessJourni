export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export const canModifyMessage = (createdAt: string, now = Date.now()) => {
  const createdAtMs = new Date(createdAt).getTime();
  const age = now - createdAtMs;
  return Number.isFinite(createdAtMs) && age >= 0 && age <= MESSAGE_EDIT_WINDOW_MS;
};
