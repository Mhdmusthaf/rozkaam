// Small shared services: platform settings, notifications, audit log, strikes.
import { and, count, eq } from 'drizzle-orm';

import { schema, type Tx } from '../db/client';
import { reliabilityScore, standingFor } from '../rules/reliability';

const { settings, notifications, auditLog, strikes, users } = schema;

// ---------------------------------------------------------------- settings
export interface Settings {
  commissionBps: number; // 1500 = 15%
  commissionMode: 'on_top' | 'deducted';
  cancelWindowHours: number;
  radiusKm: number;
  geofenceM: number;
  reminderLeadHours: number;
  minWithdrawalPaise: number;
}

export const DEFAULT_SETTINGS: Settings = {
  commissionBps: 1500,
  commissionMode: 'on_top',
  cancelWindowHours: 12,
  radiusKm: 15,
  geofenceM: 500,
  reminderLeadHours: 2,
  minWithdrawalPaise: 100_00,
};

export async function getSettings(db: Tx): Promise<Settings> {
  const rows = await db.select().from(settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export async function updateSettings(db: Tx, patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  return getSettings(db);
}

// ---------------------------------------------------------------- notifications
export interface Notice {
  title: string;
  body: string;
  icon?: string;
  tone?: 'violet' | 'success' | 'warn' | 'danger' | 'info';
  href?: string;
}

/** Stores an in-app notification. Push and email delivery hook in here later. */
export async function notify(db: Tx, userId: string, n: Notice) {
  await db.insert(notifications).values({ userId, title: n.title, body: n.body, icon: n.icon ?? 'notifications', tone: n.tone ?? 'violet', href: n.href });
}

// ---------------------------------------------------------------- audit log
export async function audit(db: Tx, adminId: string, action: string, target: string, detail?: unknown) {
  await db.insert(auditLog).values({ adminId, action, target, detail: detail ?? null });
}

// ---------------------------------------------------------------- strikes
export async function activeStrikeCount(db: Tx, workerId: string) {
  const [row] = await db.select({ n: count() }).from(strikes).where(and(eq(strikes.workerId, workerId), eq(strikes.excused, false)));
  return row?.n ?? 0;
}

/** Re-derives the account standing from active strikes. Never touches a ban. */
export async function refreshStanding(db: Tx, workerId: string) {
  const n = await activeStrikeCount(db, workerId);
  const [u] = await db.select({ status: users.status }).from(users).where(eq(users.id, workerId));
  if (u && u.status !== 'banned') {
    const next = standingFor(n);
    if (next !== u.status) await db.update(users).set({ status: next }).where(eq(users.id, workerId));
  }
  return { activeStrikes: n, reliability: reliabilityScore(n) };
}

export async function addStrike(db: Tx, workerId: string, reason: 'late_cancel' | 'no_show' | 'misconduct', jobId: string | null) {
  await db.insert(strikes).values({ workerId, reason, jobId });
  const standing = await refreshStanding(db, workerId);
  await notify(db, workerId, {
    title: reason === 'no_show' ? 'Marked as no-show' : reason === 'late_cancel' ? 'Late cancellation recorded' : 'A strike was added',
    body: `You now have ${standing.activeStrikes} active ${standing.activeStrikes === 1 ? 'strike' : 'strikes'}. Message support if it was a genuine emergency.`,
    icon: 'alert-circle',
    tone: 'danger',
    href: '/worker/reliability',
  });
  return standing;
}
