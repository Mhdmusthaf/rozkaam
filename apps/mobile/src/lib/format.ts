// Small formatting helpers shared by every screen.

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD for today + offset days. */
export const dayISO = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const dayDiff = (iso: string) => {
  const a = parseDay(iso).getTime();
  const b = parseDay(dayISO()).getTime();
  return Math.round((a - b) / 86400000);
};

/** "Today", "Tomorrow", or "Sat, 21 Nov". */
export const dayLabel = (iso: string) => {
  const diff = dayDiff(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = parseDay(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const dayLong = (iso: string) => {
  const d = parseDay(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "18:30" -> "6:30 PM" */
export const time12 = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${ap}`;
};

export const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Hours between two HH:mm values (handles past-midnight end). */
export const hoursBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
};

/** Start time of a job as a Date. */
export const jobStart = (dateISO: string, hm: string) => {
  const d = parseDay(dateISO);
  const [h, m] = hm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

export const hoursUntil = (dateISO: string, hm: string) => (jobStart(dateISO, hm).getTime() - Date.now()) / 3600000;

/** "2 min ago", "3 h ago", "Yesterday", "12 Nov" */
export const ago = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${Math.floor(diff)} min ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)} h ago`;
  if (diff < 60 * 48) return 'Yesterday';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/** Distance in metres between two coordinates. */
export const metresBetween = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
};
