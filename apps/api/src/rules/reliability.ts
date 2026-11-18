// Reliability rules: the cancellation window, strikes and account standing.

/** Cancelling a confirmed job inside the window is a late cancellation. */
export const isLateCancel = (startsAt: Date, at: Date, windowHours: number) => startsAt.getTime() - at.getTime() < windowHours * 3600_000;

/** Score shown to workers and businesses. Each active strike costs 8 points. */
export const reliabilityScore = (activeStrikes: number) => Math.max(0, 100 - activeStrikes * 8);

/**
 * What the account's standing should be for a number of active (not excused)
 * strikes. Bans are never automatic: only an admin can ban.
 */
export function standingFor(activeStrikes: number): 'active' | 'restricted' | 'suspended' {
  if (activeStrikes >= 3) return 'suspended';
  if (activeStrikes === 2) return 'restricted';
  return 'active';
}
