// Attendance rules: distance from the venue, lateness and flagging.

/** Distance in metres between two coordinates (haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** Decides whether a check-in or check-out needs a human to look at it. */
export function assess(input: { distanceM: number | null; hasPhoto: boolean; geofenceM: number }): { flagged: boolean; reason: string | null } {
  if (!input.hasPhoto) return { flagged: true, reason: 'No photo' };
  if (input.distanceM === null) return { flagged: true, reason: 'No location' };
  if (input.distanceM > input.geofenceM) return { flagged: true, reason: `${input.distanceM} m from venue` };
  return { flagged: false, reason: null };
}

/** A worker is late if they check in after the reporting time plus a short grace. */
export const isLate = (checkedInAt: Date, reportAt: Date, graceMinutes = 5) => checkedInAt.getTime() > reportAt.getTime() + graceMinutes * 60_000;

/** Check-in opens a few hours before the reporting time and closes when the shift ends. */
export function checkInWindow(reportAt: Date, endAt: Date, at: Date, openHoursBefore = 3) {
  if (at.getTime() < reportAt.getTime() - openHoursBefore * 3600_000) return 'too_early' as const;
  if (at.getTime() > endAt.getTime()) return 'too_late' as const;
  return 'open' as const;
}
