// Requirements (jobs), applications, attendance and settlement.
// Every rule that costs money or trust is enforced here, on the server.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { schema, type Db, type Tx } from '../db/client';
import { istInstant, minutesBetween, now } from '../lib/clock';
import { bad, conflict, forbidden, notFound } from '../lib/errors';
import { collectFunding } from '../providers/payments';
import { assess, checkInWindow, distanceMeters, isLate } from '../rules/attendance';
import { fundingTotal, settlement, slotMoney } from '../rules/money';
import { isLateCancel } from '../rules/reliability';
import { reliabilityScore } from '../rules/reliability';
import { addStrike, audit, getSettings, notify } from './core';

const { jobs, applications, attendance, ledger, businesses, workerProfiles, users, ratings, strikes } = schema;

type Job = typeof jobs.$inferSelect;
type Application = typeof applications.$inferSelect;

const HM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

export const jobInput = z.object({
  title: z.string().trim().min(3).max(80),
  category: z.string().min(2).max(40),
  description: z.string().max(600).default(''),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportTime: HM,
  startTime: HM,
  endTime: HM,
  payPaise: z.number().int().min(100_00).max(50_000_00),
  needed: z.number().int().min(1).max(500),
  venue: z.string().trim().min(2).max(100),
  address: z.string().max(200).default(''),
  area: z.string().max(60).default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  dress: z.string().max(200).default(''),
  gender: z.enum(['Any', 'Male', 'Female']).default('Any'),
  skills: z.array(z.string().max(40)).max(10).default([]),
  experience: z.string().max(30).default(''),
  instructions: z.string().max(600).default(''),
  pocName: z.string().max(80).default(''),
  pocPhone: z.string().max(20).default(''),
  urgent: z.boolean().default(false),
});

const terms = (j: Job) => ({ payPaise: j.payPaise, commissionBps: j.commissionBps, commissionMode: j.commissionMode });
const endInstant = (j: Job) => {
  const end = istInstant(j.workDate, j.endTime);
  // A shift that ends after midnight ends on the next day.
  return end > j.startsAt ? end : new Date(end.getTime() + 86_400_000);
};

async function jobOr404(db: Tx, jobId: string) {
  const [j] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!j) throw notFound('Requirement');
  return j;
}

async function ownedJob(db: Tx, ownerUserId: string, jobId: string) {
  const j = await jobOr404(db, jobId);
  const [b] = await db.select().from(businesses).where(eq(businesses.id, j.businessId));
  if (!b || b.ownerUserId !== ownerUserId) throw notFound('Requirement');
  return { job: j, business: b };
}

const countByStatus = async (db: Tx, jobId: string, statuses: Application['status'][]) => {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(eq(applications.jobId, jobId), inArray(applications.status, statuses)));
  return r?.n ?? 0;
};

/** Slots that are taken: confirmed, on site, finished or paid. */
const HOLDING: Application['status'][] = ['confirmed', 'checked_in', 'checked_out', 'paid'];

// ================================================================ business
export async function createJob(db: Db, ownerUserId: string, input: z.infer<typeof jobInput>) {
  const [b] = await db.select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId));
  if (!b) throw notFound('Business');
  if (b.kycStatus !== 'verified') throw forbidden('Your business must be verified before you can post work.');
  const startsAt = istInstant(input.workDate, input.startTime);
  if (startsAt <= now()) throw bad('in_the_past', 'The start time must be in the future.');
  if (istInstant(input.workDate, input.reportTime) > startsAt) throw bad('report_after_start', 'The reporting time must be before the start time.');
  const s = await getSettings(db);
  const [job] = await db
    .insert(jobs)
    .values({ ...input, businessId: b.id, startsAt, commissionBps: s.commissionBps, commissionMode: s.commissionMode })
    .returning();
  return job!;
}

/** The business pays up front; only then does the requirement go live. */
export async function fundJob(db: Db, ownerUserId: string, jobId: string) {
  const { job, business } = await ownedJob(db, ownerUserId, jobId);
  if (job.status !== 'awaiting_funding') throw conflict('already_funded', 'This requirement is already funded.');
  if (job.startsAt <= now()) throw bad('in_the_past', 'This requirement has already started. Post a new one.');
  const total = fundingTotal(terms(job), job.needed).total;
  const pay = await collectFunding(total, business.id);
  if (!pay.ok) throw bad('payment_failed', 'The payment did not go through. Try again.');
  return db.transaction(async (tx) => {
    await tx.insert(ledger).values({ type: 'funding', amountPaise: total, jobId, businessId: business.id, ref: pay.reference, note: pay.provider });
    const [j] = await tx.update(jobs).set({ status: 'open', fundedAt: now() }).where(eq(jobs.id, jobId)).returning();
    await notify(tx, ownerUserId, { title: 'Requirement is live', body: `${job.title} is now visible to nearby workers.`, icon: 'megaphone', href: `/business/requirement/${jobId}` });
    return j!;
  });
}

export async function cancelJob(db: Db, ownerUserId: string, jobId: string) {
  const { job, business } = await ownedJob(db, ownerUserId, jobId);
  if (!['awaiting_funding', 'open', 'filled'].includes(job.status)) throw conflict('cannot_cancel', 'This requirement can no longer be cancelled.');
  return db.transaction(async (tx) => {
    if (job.status !== 'awaiting_funding') {
      await tx.insert(ledger).values({ type: 'refund', amountPaise: fundingTotal(terms(job), job.needed).total, jobId, businessId: business.id, note: 'Requirement cancelled' });
    }
    const affected = await tx.select().from(applications).where(and(eq(applications.jobId, jobId), inArray(applications.status, ['applied', 'waitlisted', 'confirmed'])));
    for (const a of affected) {
      await tx.update(applications).set({ status: 'cancelled' }).where(eq(applications.id, a.id));
      await notify(tx, a.workerId, { title: 'Job cancelled by the company', body: `${job.title} on ${job.workDate} was cancelled. This does not affect your reliability.`, icon: 'close-circle', tone: 'warn' });
    }
    const [j] = await tx.update(jobs).set({ status: 'cancelled', closedAt: now() }).where(eq(jobs.id, jobId)).returning();
    return j!;
  });
}

/** A confirmed worker who did not turn up. Allowed once the reporting time has passed. */
export async function markNoShow(db: Db, actor: { ownerUserId?: string; adminId?: string }, applicationId: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!app) throw notFound('Application');
  const job = actor.ownerUserId ? (await ownedJob(db, actor.ownerUserId, app.jobId)).job : await jobOr404(db, app.jobId);
  if (app.status !== 'confirmed') throw conflict('not_confirmed', 'Only a confirmed worker who has not checked in can be marked as a no-show.');
  if (now() < istInstant(job.workDate, job.reportTime)) throw bad('too_early', 'You can mark a no-show after the reporting time.');
  await db.transaction(async (tx) => {
    await tx.update(applications).set({ status: 'no_show' }).where(eq(applications.id, app.id));
    await addStrike(tx, app.workerId, 'no_show', job.id);
    if (actor.adminId) await audit(tx, actor.adminId, 'mark_no_show', app.id, { jobId: job.id });
  });
}

/**
 * The business confirms who worked. Workers are paid, Rozkaam's commission is
 * recorded, unused slots are refunded, and remaining confirmed workers who
 * never checked in become no-shows.
 */
export async function approveAttendance(db: Db, ownerUserId: string, jobId: string) {
  const { job, business } = await ownedJob(db, ownerUserId, jobId);
  if (!['in_progress', 'completed', 'filled', 'open'].includes(job.status)) throw conflict('cannot_approve', 'Attendance for this requirement cannot be approved now.');
  if (now() < job.startsAt) throw bad('too_early', 'You can approve attendance once the shift has started.');

  return db.transaction(async (tx) => {
    const apps = await tx.select().from(applications).where(eq(applications.jobId, jobId));
    const worked = apps.filter((a) => a.status === 'checked_in' || a.status === 'checked_out');
    const absent = apps.filter((a) => a.status === 'confirmed');
    const s = settlement(terms(job), job.needed, worked.length);
    const per = slotMoney(terms(job));
    const minutes = minutesBetween(job.startTime, job.endTime);

    for (const a of worked) {
      await tx.insert(ledger).values({ type: 'payout', amountPaise: per.workerGets, jobId, applicationId: a.id, businessId: business.id, workerId: a.workerId });
      await tx.update(applications).set({ status: 'paid' }).where(eq(applications.id, a.id));
      await tx
        .update(workerProfiles)
        .set({ jobsDone: sql`${workerProfiles.jobsDone} + 1`, minutesWorked: sql`${workerProfiles.minutesWorked} + ${minutes}` })
        .where(eq(workerProfiles.userId, a.workerId));
      await notify(tx, a.workerId, { title: `₹${per.workerGets / 100} added to your wallet`, body: `${business.name} completed the payout for ${job.title}.`, icon: 'wallet', tone: 'success', href: '/worker/payments' });
    }
    for (const a of absent) {
      await tx.update(applications).set({ status: 'no_show' }).where(eq(applications.id, a.id));
      await addStrike(tx, a.workerId, 'no_show', jobId);
    }
    // Anyone still waiting is released.
    await tx.update(applications).set({ status: 'rejected' }).where(and(eq(applications.jobId, jobId), inArray(applications.status, ['applied', 'waitlisted'])));

    if (s.commission > 0) await tx.insert(ledger).values({ type: 'commission', amountPaise: s.commission, jobId, businessId: business.id });
    if (s.refund > 0) await tx.insert(ledger).values({ type: 'refund', amountPaise: s.refund, jobId, businessId: business.id, note: `${job.needed - worked.length} unused slots` });
    await tx.update(jobs).set({ status: 'paid', closedAt: now() }).where(eq(jobs.id, jobId));
    await notify(tx, ownerUserId, { title: 'Pay released', body: `${worked.length} workers were paid for ${job.title}.`, icon: 'cash', tone: 'success', href: `/business/requirement/${jobId}` });
    return { ...s, workersPaid: worked.length, noShows: absent.length };
  });
}

export async function listBusinessJobs(db: Db, ownerUserId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId));
  if (!b) throw notFound('Business');
  const rows = await db.select().from(jobs).where(eq(jobs.businessId, b.id)).orderBy(desc(jobs.startsAt));
  return Promise.all(rows.map((j) => summarise(db, j)));
}

async function summarise(db: Tx, j: Job) {
  const confirmed = await countByStatus(db, j.id, HOLDING);
  const applied = await countByStatus(db, j.id, ['applied', 'waitlisted', ...HOLDING]);
  return { ...j, confirmed, applied, money: fundingTotal(terms(j), j.needed) };
}

/** Requirement with its roster, as the business sees it. Phone numbers are never included. */
export async function getBusinessJob(db: Db, ownerUserId: string, jobId: string) {
  const { job } = await ownedJob(db, ownerUserId, jobId);
  return { ...(await summarise(db, job)), roster: await roster(db, jobId, false) };
}

/** Roster rows. Pending applicants are only listed for admins: the business sees who is confirmed. */
export async function roster(db: Tx, jobId: string, includePending: boolean) {
  const rows = await db
    .select({ app: applications, profile: workerProfiles })
    .from(applications)
    .innerJoin(workerProfiles, eq(workerProfiles.userId, applications.workerId))
    .where(eq(applications.jobId, jobId));
  const att = await db
    .select()
    .from(attendance)
    .where(inArray(attendance.applicationId, rows.length ? rows.map((r) => r.app.id) : ['00000000-0000-0000-0000-000000000000']));
  const rated = await db.select().from(ratings).where(and(eq(ratings.direction, 'business_to_worker'), inArray(ratings.applicationId, rows.length ? rows.map((r) => r.app.id) : ['00000000-0000-0000-0000-000000000000'])));
  const strikeRows = await db
    .select({ workerId: strikes.workerId, n: sql<number>`count(*)::int` })
    .from(strikes)
    .where(and(eq(strikes.excused, false), inArray(strikes.workerId, rows.length ? rows.map((r) => r.app.workerId) : ['00000000-0000-0000-0000-000000000000'])))
    .groupBy(strikes.workerId);
  const activeStrikes = (workerId: string) => strikeRows.find((x) => x.workerId === workerId)?.n ?? 0;
  return rows
    .filter((r) => includePending || !['applied', 'rejected', 'cancelled'].includes(r.app.status))
    .map((r) => ({
      activeStrikes: activeStrikes(r.app.workerId),
      reliability: reliabilityScore(activeStrikes(r.app.workerId)),
      appliedAt: r.app.appliedAt,
      applicationId: r.app.id,
      workerId: r.app.workerId,
      status: r.app.status,
      name: r.profile.name,
      photoKey: r.profile.photoKey,
      rating: r.profile.ratingCount ? Math.round((r.profile.ratingSum / r.profile.ratingCount) * 10) / 10 : 0,
      jobsDone: r.profile.jobsDone,
      skills: r.profile.skills,
      checkIn: att.find((a) => a.applicationId === r.app.id && a.kind === 'in') ?? null,
      checkOut: att.find((a) => a.applicationId === r.app.id && a.kind === 'out') ?? null,
      rated: rated.find((x) => x.applicationId === r.app.id)?.stars ?? null,
    }));
}

// ================================================================ worker
export const feedQuery = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(100).optional(),
  category: z.string().optional(),
  minPayPaise: z.coerce.number().int().optional(),
  sort: z.enum(['nearest', 'pay', 'soonest']).default('nearest'),
});

/** Open jobs near the worker that they have not applied for yet. */
export async function jobFeed(db: Db, workerId: string, q: z.infer<typeof feedQuery>) {
  const s = await getSettings(db);
  const [p] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, workerId));
  const lat = q.lat ?? p?.lat ?? null;
  const lng = q.lng ?? p?.lng ?? null;
  const radiusM = (q.radiusKm ?? s.radiusKm) * 1000;
  const open = await db
    .select({ job: jobs, business: businesses })
    .from(jobs)
    .innerJoin(businesses, eq(businesses.id, jobs.businessId))
    .where(and(inArray(jobs.status, ['open', 'filled']), sql`${jobs.startsAt} > ${now()}`));
  const mine = new Set((await db.select({ jobId: applications.jobId }).from(applications).where(and(eq(applications.workerId, workerId), inArray(applications.status, ['applied', 'waitlisted', ...HOLDING])))).map((r) => r.jobId));

  const out = [];
  for (const { job, business } of open) {
    if (mine.has(job.id)) continue;
    if (q.category && job.category !== q.category) continue;
    const pay = slotMoney(terms(job)).workerGets;
    if (q.minPayPaise && pay < q.minPayPaise) continue;
    const distanceM = lat !== null && lng !== null ? distanceMeters(lat, lng, job.lat, job.lng) : null;
    if (distanceM !== null && distanceM > radiusM) continue;
    out.push(workerView(job, business, await countByStatus(db, job.id, HOLDING), distanceM));
  }
  return out.sort((a, b) => (q.sort === 'pay' ? b.workerPayPaise - a.workerPayPaise : q.sort === 'soonest' ? a.startsAt.getTime() - b.startsAt.getTime() : (a.distanceM ?? 0) - (b.distanceM ?? 0)));
}

/** A job as a worker sees it. The contact person is only included once confirmed. */
function workerView(job: Job, business: typeof businesses.$inferSelect, confirmed: number, distanceM: number | null, showContact = false) {
  const { pocName, pocPhone, commissionBps: _b, commissionMode: _m, payPaise: _p, ...rest } = job;
  return {
    ...rest,
    workerPayPaise: slotMoney(terms(job)).workerGets,
    slotsLeft: Math.max(0, job.needed - confirmed),
    distanceM,
    business: { id: business.id, name: business.name, rating: business.ratingCount ? Math.round((business.ratingSum / business.ratingCount) * 10) / 10 : 0, verified: business.kycStatus === 'verified' },
    contact: showContact ? { name: pocName, phone: pocPhone } : null,
  };
}

export async function getJobForWorker(db: Db, workerId: string, jobId: string) {
  const job = await jobOr404(db, jobId);
  if (job.status === 'awaiting_funding') throw notFound('Job');
  const [business] = await db.select().from(businesses).where(eq(businesses.id, job.businessId));
  const [mine] = await db.select().from(applications).where(and(eq(applications.jobId, jobId), eq(applications.workerId, workerId)));
  const showContact = !!mine && ['confirmed', 'checked_in'].includes(mine.status);
  return { ...workerView(job, business!, await countByStatus(db, jobId, HOLDING), null, showContact), application: mine ?? null };
}

export async function apply(db: Db, workerId: string, jobId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, workerId));
  const [p] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, workerId));
  if (!p || p.kycStatus !== 'verified') throw forbidden('Your account must be verified before you can apply.');
  if (u!.status === 'suspended') throw forbidden('Your account is suspended. Message support to have it reviewed.');
  const job = await jobOr404(db, jobId);
  if (!['open', 'filled'].includes(job.status) || job.startsAt <= now()) throw conflict('closed', 'This job is no longer taking applications.');
  if (job.gender !== 'Any' && p.gender !== job.gender) throw forbidden('This job has a requirement your profile does not match.');
  if (u!.status === 'restricted') {
    // A restricted account may hold only one live application at a time.
    const [live] = await db.select({ n: sql<number>`count(*)::int` }).from(applications).where(and(eq(applications.workerId, workerId), inArray(applications.status, ['applied', 'waitlisted', 'confirmed'])));
    if ((live?.n ?? 0) >= 1) throw forbidden('Your account is restricted to one application at a time.');
  }
  const [existing] = await db.select().from(applications).where(and(eq(applications.jobId, jobId), eq(applications.workerId, workerId)));
  if (existing && !['cancelled'].includes(existing.status)) throw conflict('already_applied', 'You have already applied for this job.');
  const [app] = existing
    ? await db.update(applications).set({ status: 'applied', appliedAt: now(), decidedAt: null, decidedBy: null }).where(eq(applications.id, existing.id)).returning()
    : await db.insert(applications).values({ jobId, workerId, appliedAt: now() }).returning();
  await notify(db, workerId, { title: 'Application received', body: `You applied for ${job.title}. The Rozkaam team is reviewing it.`, icon: 'paper-plane', href: `/worker/gig/${app!.id}` });
  return app!;
}

async function ownApp(db: Tx, workerId: string, applicationId: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!app || app.workerId !== workerId) throw notFound('Application');
  return { app, job: await jobOr404(db, app.jobId) };
}

export async function listWorkerApplications(db: Db, workerId: string) {
  const rows = await db
    .select({ app: applications, job: jobs, business: businesses })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(businesses, eq(businesses.id, jobs.businessId))
    .where(eq(applications.workerId, workerId))
    .orderBy(desc(jobs.startsAt));
  const ids = rows.length ? rows.map((r) => r.app.id) : ['00000000-0000-0000-0000-000000000000'];
  const att = await db.select().from(attendance).where(inArray(attendance.applicationId, ids));
  const mine = await db.select().from(ratings).where(and(eq(ratings.direction, 'worker_to_business'), inArray(ratings.applicationId, ids)));
  return Promise.all(
    rows.map(async (r) => ({
      ...r.app,
      job: workerView(r.job, r.business, await countByStatus(db, r.job.id, HOLDING), null, ['confirmed', 'checked_in'].includes(r.app.status)),
      checkIn: att.find((a) => a.applicationId === r.app.id && a.kind === 'in') ?? null,
      checkOut: att.find((a) => a.applicationId === r.app.id && a.kind === 'out') ?? null,
      ratedBusiness: mine.find((x) => x.applicationId === r.app.id)?.stars ?? null,
    })),
  );
}

export async function getWorkerApplication(db: Db, workerId: string, applicationId: string) {
  const { app, job } = await ownApp(db, workerId, applicationId);
  const [business] = await db.select().from(businesses).where(eq(businesses.id, job.businessId));
  const att = await db.select().from(attendance).where(eq(attendance.applicationId, app.id));
  const [myRating] = await db.select().from(ratings).where(and(eq(ratings.applicationId, app.id), eq(ratings.direction, 'worker_to_business')));
  return {
    ...app,
    job: workerView(job, business!, await countByStatus(db, job.id, HOLDING), null, ['confirmed', 'checked_in'].includes(app.status)),
    checkIn: att.find((a) => a.kind === 'in') ?? null,
    checkOut: att.find((a) => a.kind === 'out') ?? null,
    ratedBusiness: myRating?.stars ?? null,
  };
}

/** Free before confirmation, and free up to the cancellation window; a strike after that. */
export async function cancelApplication(db: Db, workerId: string, applicationId: string) {
  const { app, job } = await ownApp(db, workerId, applicationId);
  if (!['applied', 'waitlisted', 'confirmed'].includes(app.status)) throw conflict('cannot_cancel', 'This application can no longer be cancelled.');
  const s = await getSettings(db);
  const late = app.status === 'confirmed' && isLateCancel(job.startsAt, now(), s.cancelWindowHours);
  await db.transaction(async (tx) => {
    await tx.update(applications).set({ status: late ? 'late_cancel' : 'cancelled' }).where(eq(applications.id, app.id));
    if (app.status === 'confirmed' && job.status === 'filled') await tx.update(jobs).set({ status: 'open' }).where(eq(jobs.id, job.id));
    if (late) await addStrike(tx, workerId, 'late_cancel', job.id);
  });
  return { status: late ? ('late_cancel' as const) : ('cancelled' as const) };
}

export const attendanceInput = z.object({ photoKey: z.string().nullable().default(null), lat: z.number().nullable().default(null), lng: z.number().nullable().default(null) });

/** Check-in or check-out. The time is the server's clock; distance is computed here. */
export async function recordAttendance(db: Db, workerId: string, applicationId: string, kind: 'in' | 'out', input: z.infer<typeof attendanceInput>) {
  const { app, job } = await ownApp(db, workerId, applicationId);
  if (kind === 'in' && app.status !== 'confirmed') throw conflict('not_confirmed', 'You can only check in to a job you are confirmed for.');
  if (kind === 'out' && app.status !== 'checked_in') throw conflict('not_checked_in', 'Check in before checking out.');
  const at = now();
  const reportAt = istInstant(job.workDate, job.reportTime);
  if (kind === 'in') {
    const w = checkInWindow(reportAt, endInstant(job), at);
    if (w === 'too_early') throw bad('too_early', 'Check-in opens 3 hours before the reporting time.');
    if (w === 'too_late') throw bad('too_late', 'This shift has already ended.');
  }
  const s = await getSettings(db);
  const distanceM = input.lat !== null && input.lng !== null ? distanceMeters(input.lat, input.lng, job.lat, job.lng) : null;
  const a = assess({ distanceM, hasPhoto: !!input.photoKey, geofenceM: s.geofenceM });
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(attendance)
      .values({ applicationId: app.id, kind, at, photoKey: input.photoKey, lat: input.lat, lng: input.lng, distanceM, flag: a.flagged ? 'open' : 'none', flagReason: a.reason, late: kind === 'in' && isLate(at, reportAt) })
      .returning();
    await tx.update(applications).set({ status: kind === 'in' ? 'checked_in' : 'checked_out' }).where(eq(applications.id, app.id));
    if (kind === 'in' && ['open', 'filled'].includes(job.status)) await tx.update(jobs).set({ status: 'in_progress' }).where(eq(jobs.id, job.id));
    if (kind === 'out') {
      // When nobody is still expected or on site, the job waits for the business to approve attendance.
      const remaining = await countByStatus(tx, job.id, ['confirmed', 'checked_in']);
      if (remaining === 0) {
        await tx.update(jobs).set({ status: 'completed' }).where(eq(jobs.id, job.id));
        const [b] = await tx.select().from(businesses).where(eq(businesses.id, job.businessId));
        await notify(tx, b!.ownerUserId, { title: 'Attendance needs your approval', body: `${job.title} has finished. Approve to release pay.`, icon: 'alert-circle', tone: 'warn', href: `/business/requirement/${job.id}` });
      }
    }
    return row!;
  });
}

// ================================================================ ratings
export const ratingInput = z.object({ stars: z.number().int().min(1).max(5), tags: z.array(z.string().max(40)).max(8).default([]), comment: z.string().max(300).default('') });

export async function rateBusiness(db: Db, workerId: string, applicationId: string, input: z.infer<typeof ratingInput>) {
  const { app, job } = await ownApp(db, workerId, applicationId);
  if (!['checked_out', 'paid'].includes(app.status)) throw conflict('not_finished', 'You can rate the company after you finish the job.');
  await db.transaction(async (tx) => {
    const [r] = await tx.insert(ratings).values({ applicationId, direction: 'worker_to_business', ...input }).onConflictDoNothing().returning();
    if (!r) throw conflict('already_rated', 'You have already rated this company for this job.');
    await tx.update(businesses).set({ ratingSum: sql`${businesses.ratingSum} + ${input.stars}`, ratingCount: sql`${businesses.ratingCount} + 1` }).where(eq(businesses.id, job.businessId));
  });
}

export async function rateWorker(db: Db, ownerUserId: string, applicationId: string, input: z.infer<typeof ratingInput>) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!app) throw notFound('Application');
  await ownedJob(db, ownerUserId, app.jobId);
  if (app.status !== 'paid') throw conflict('not_finished', 'You can rate workers after pay is released.');
  await db.transaction(async (tx) => {
    const [r] = await tx.insert(ratings).values({ applicationId, direction: 'business_to_worker', ...input }).onConflictDoNothing().returning();
    if (!r) throw conflict('already_rated', 'You have already rated this worker for this job.');
    await tx.update(workerProfiles).set({ ratingSum: sql`${workerProfiles.ratingSum} + ${input.stars}`, ratingCount: sql`${workerProfiles.ratingCount} + 1` }).where(eq(workerProfiles.userId, app.workerId));
  });
}

// ================================================================ ops team
/** Rozkaam's ops team confirms, waitlists or rejects each applicant. */
export async function decideApplication(db: Db, adminId: string, applicationId: string, decision: 'approve' | 'waitlist' | 'reject') {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!app) throw notFound('Application');
  const job = await jobOr404(db, app.jobId);
  if (!['applied', 'waitlisted'].includes(app.status)) throw conflict('already_decided', 'This application has already been decided.');
  if (!['open', 'filled'].includes(job.status)) throw conflict('closed', 'This requirement is not taking workers now.');
  return db.transaction(async (tx) => {
    const confirmed = await countByStatus(tx, job.id, HOLDING);
    if (decision === 'approve' && confirmed >= job.needed) throw conflict('full', 'Every slot is already confirmed. Waitlist this worker instead.');
    const status = decision === 'approve' ? 'confirmed' : decision === 'waitlist' ? 'waitlisted' : 'rejected';
    await tx.update(applications).set({ status, decidedAt: now(), decidedBy: adminId }).where(eq(applications.id, app.id));
    if (decision === 'approve' && confirmed + 1 >= job.needed) {
      await tx.update(jobs).set({ status: 'filled' }).where(eq(jobs.id, job.id));
      const [b] = await tx.select().from(businesses).where(eq(businesses.id, job.businessId));
      await notify(tx, b!.ownerUserId, { title: 'Team fully confirmed', body: `${job.title}: ${job.needed} of ${job.needed} workers confirmed by Rozkaam.`, icon: 'checkmark-done', tone: 'success', href: `/business/requirement/${job.id}` });
    }
    await notify(
      tx,
      app.workerId,
      decision === 'approve'
        ? { title: "You're confirmed", body: `${job.title} at ${job.venue}. Report by ${job.reportTime} on ${job.workDate}.`, icon: 'checkmark-circle', tone: 'success', href: `/worker/gig/${app.id}` }
        : decision === 'waitlist'
          ? { title: "You're on the waitlist", body: `${job.title} is full. We will confirm you if a slot opens.`, icon: 'hourglass', tone: 'warn', href: `/worker/gig/${app.id}` }
          : { title: 'Not selected this time', body: `You were not selected for ${job.title}. New jobs are posted every day.`, icon: 'information-circle', tone: 'info' },
    );
    await audit(tx, adminId, `application_${decision}`, app.id, { jobId: job.id, workerId: app.workerId });
    return { status };
  });
}
