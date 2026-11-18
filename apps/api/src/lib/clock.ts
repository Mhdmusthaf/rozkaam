// All timestamps come from the server clock, never from a phone.
// Tests can freeze time with setNow().
let fixed: Date | null = null;

export const now = () => (fixed ? new Date(fixed) : new Date());
export const setNow = (d: Date | null) => {
  fixed = d;
};

/** India has one time zone, UTC+05:30, with no daylight saving. */
const IST = '+05:30';

/** The exact instant of a date (YYYY-MM-DD) and time (HH:mm) in India. */
export const istInstant = (dateISO: string, hm: string) => new Date(`${dateISO}T${hm}:00${IST}`);

/** Today's date in India as YYYY-MM-DD. */
export const istToday = (at = now()) => new Date(at.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number) as [number, number];
  const [eh, em] = end.split(':').map(Number) as [number, number];
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
};
