/** When scheduler login is off, APIs use this id for the synthetic guest session. */
export const ANONYMOUS_SCHEDULER_USER_ID = "__scheduler_anonymous__" as const;

export function isAnonymousSchedulerSession(userId: string): boolean {
  return userId === ANONYMOUS_SCHEDULER_USER_ID;
}
