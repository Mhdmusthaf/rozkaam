// Everything the ops team does in the admin panel. Every action is audited.
import { desc, eq, inArray, sql } from 'drizzle-orm';

import { schema, type Db } from '../db/client';
import { bad, conflict, notFound } from '../lib/errors';
import { addStrike, audit, notify, refreshStanding } from './core';
import { roster } from './jobs';

const { users, workerProfiles, businesses, jobs, applications, attendance, ledger, withdrawals, strikes, auditLog } = schema;

// ---------------------------------------------------------------- dashboard
/** Headline numbers. GMV, payouts and revenue are separate figures. */
export async function dashboard(db: Db) {
  const [money] = await db
    .select({
      payouts: sql<number>`coalesce(sum(${ledger.amountPaise}) filter (where ${ledger.type} = 'payout'), 0)::int`,
      revenue: sql<number>`coalesce(sum(${ledger.amountPaise}) filter (where ${ledger.type} = 'commission'), 0)::int`,
      funded: sql<number>`coalesce(sum(${ledger.amountPaise}) filter (where ${ledger.type} = 'funding'), 0)::int`,
      refunded: sql<number>`coalesce(sum(${ledger.amountPaise}) filter (where ${ledger.type} = 'refund'), 0)::int`,
    })
    .from(ledger);
  // GMV = advertised pay for every slot that was actually worked.
  const [gmv] = await db
    .select({ n: sql<number>`coalesce(sum(${jobs.payPaise}), 0)::int` })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.status, 'paid'));
  const byStatus = await db.select({ status: jobs.status, n: sql<number>`count(*)::int` }).from(jobs).groupBy(jobs.status);
  const [apps] = await db
    .select({
      worked: sql<number>`count(*) filter (where ${applications.status} = 'paid')::int`,
      noShow: sql<number>`count(*) filter (where ${applications.status} = 'no_show')::int`,
      pending: sql<number>`count(*) filter (where ${applications.status} = 'applied')::int`,
    })
    .from(applications);
  const [queues] = await db
    .select({
      workerKyc: sql<number>`(select count(*) from ${workerProfiles} where ${workerProfiles.kycStatus} = 'pending')::int`,
      businessKyc: sql<number>`(select count(*) from ${businesses} where ${businesses.kycStatus} = 'pending')::int`,
      flags: sql<number>`(select count(*) from ${attendance} where ${attendance.flag} = 'open')::int`,
      withdrawals: sql<number>`(select count(*) from ${withdrawals} where ${withdrawals.status} = 'requested')::int`,
    })
    .from(sql`(select 1) as one`);
  const worked = apps?.worked ?? 0;
  const noShow = apps?.noShow ?? 0;
  return {
    gmvPaise: gmv?.n ?? 0,
    revenuePaise: money?.revenue ?? 0,
    payoutsPaise: money?.payouts ?? 0,
    fundedPaise: money?.funded ?? 0,
    refundedPaise: money?.refunded ?? 0,
    requirementsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    noShowRate: worked + noShow ? noShow / (worked + noShow) : 0,
    queues: { applicants: apps?.pending ?? 0, ...queues },
  };
}

// ---------------------------------------------------------------- KYC
export async function kycQueue(db: Db, kind: 'worker' | 'business', status: 'pending' | 'rejected' | 'verified' = 'pending') {
  if (kind === 'worker') {
    return db
      .select({ profile: workerProfiles, phone: users.phone })
      .from(workerProfiles)
      .innerJoin(users, eq(users.id, workerProfiles.userId))
      .where(eq(workerProfiles.kycStatus, status))
      .orderBy(workerProfiles.createdAt);
  }
  return db
    .select({ business: businesses, phone: users.phone })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerUserId))
    .where(eq(businesses.kycStatus, status))
    .orderBy(businesses.createdAt);
}

export async function decideKyc(db: Db, adminId: string, kind: 'worker' | 'business', id: string, approve: boolean, note?: string) {
  if (!approve && !note?.trim()) throw bad('reason_required', 'Give a reason so the person knows what to fix.');
  return db.transaction(async (tx) => {
    let userId: string;
    if (kind === 'worker') {
      const [p] = await tx.select().from(workerProfiles).where(eq(workerProfiles.userId, id));
      if (!p) throw notFound('Worker');
      if (p.kycStatus !== 'pending' && p.kycStatus !== 'rejected') throw conflict('not_pending', 'This submission is not waiting for review.');
      await tx.update(workerProfiles).set({ kycStatus: approve ? 'verified' : 'rejected', kycNote: approve ? null : note }).where(eq(workerProfiles.userId, id));
      userId = id;
    } else {
      const [b] = await tx.select().from(businesses).where(eq(businesses.id, id));
      if (!b) throw notFound('Business');
      if (b.kycStatus !== 'pending' && b.kycStatus !== 'rejected') throw conflict('not_pending', 'This submission is not waiting for review.');
      await tx.update(businesses).set({ kycStatus: approve ? 'verified' : 'rejected', kycNote: approve ? null : note }).where(eq(businesses.id, id));
      userId = b.ownerUserId;
    }
    await notify(
      tx,
      userId,
      approve
        ? { title: 'Account activated', body: kind === 'worker' ? 'Your KYC is verified. You can now apply for jobs.' : 'Your business is verified. You can now post requirements.', icon: 'shield-checkmark', tone: 'success' }
        : { title: 'Verification needs a fix', body: note!, icon: 'alert-circle', tone: 'warn' },
    );
    await audit(tx, adminId, `kyc_${kind}_${approve ? 'approved' : 'rejected'}`, id, note ? { note } : undefined);
    return { kycStatus: approve ? 'verified' : 'rejected' };
  });
}

// ---------------------------------------------------------------- requirements
export async function listJobs(db: Db, status?: string) {
  const rows = await db
    .select({ job: jobs, business: businesses.name })
    .from(jobs)
    .innerJoin(businesses, eq(businesses.id, jobs.businessId))
    .where(status ? eq(jobs.status, status as (typeof jobs.$inferSelect)['status']) : undefined)
    .orderBy(desc(jobs.startsAt));
  const counts = await db
    .select({
      jobId: applications.jobId,
      confirmed: sql<number>`count(*) filter (where ${applications.status} in ('confirmed','checked_in','checked_out','paid'))::int`,
      waiting: sql<number>`count(*) filter (where ${applications.status} = 'applied')::int`,
    })
    .from(applications)
    .groupBy(applications.jobId);
  return rows.map((r) => ({ ...r.job, business: r.business, confirmed: counts.find((c) => c.jobId === r.job.id)?.confirmed ?? 0, waiting: counts.find((c) => c.jobId === r.job.id)?.waiting ?? 0 }));
}

export async function getJob(db: Db, jobId: string) {
  const [row] = await db.select({ job: jobs, business: businesses }).from(jobs).innerJoin(businesses, eq(businesses.id, jobs.businessId)).where(eq(jobs.id, jobId));
  if (!row) throw notFound('Requirement');
  const money = await db.select().from(ledger).where(eq(ledger.jobId, jobId)).orderBy(ledger.createdAt);
  return { ...row.job, business: row.business, roster: await roster(db, jobId, true), ledger: money };
}

// ---------------------------------------------------------------- attendance flags
export async function listFlags(db: Db, state: 'open' | 'accepted' | 'no_show' = 'open') {
  return db
    .select({ attendance, applicationId: applications.id, workerName: workerProfiles.name, jobTitle: jobs.title, venue: jobs.venue, jobId: jobs.id })
    .from(attendance)
    .innerJoin(applications, eq(applications.id, attendance.applicationId))
    .innerJoin(workerProfiles, eq(workerProfiles.userId, applications.workerId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(attendance.flag, state))
    .orderBy(desc(attendance.at));
}

/** Accept a flagged check-in as genuine, or rule that the worker was not there. */
export async function resolveFlag(db: Db, adminId: string, attendanceId: string, accept: boolean) {
  const [row] = await db.select({ a: attendance, app: applications }).from(attendance).innerJoin(applications, eq(applications.id, attendance.applicationId)).where(eq(attendance.id, attendanceId));
  if (!row) throw notFound('Flag');
  if (row.a.flag !== 'open') throw conflict('already_resolved', 'This flag has already been resolved.');
  return db.transaction(async (tx) => {
    await tx.update(attendance).set({ flag: accept ? 'accepted' : 'no_show' }).where(eq(attendance.id, attendanceId));
    if (!accept) {
      if (row.app.status === 'paid') throw conflict('already_paid', 'This worker has already been paid for the job.');
      await tx.update(applications).set({ status: 'no_show' }).where(eq(applications.id, row.app.id));
      await addStrike(tx, row.app.workerId, 'no_show', row.app.jobId);
    }
    await audit(tx, adminId, accept ? 'flag_accepted' : 'flag_no_show', attendanceId, { applicationId: row.app.id });
    return { flag: accept ? 'accepted' : 'no_show' };
  });
}

// ---------------------------------------------------------------- people
export async function listUsers(db: Db, role: 'worker' | 'business') {
  if (role === 'worker') {
    return db
      .select({ id: users.id, phone: users.phone, status: users.status, name: workerProfiles.name, area: workerProfiles.area, kycStatus: workerProfiles.kycStatus, jobsDone: workerProfiles.jobsDone, ratingSum: workerProfiles.ratingSum, ratingCount: workerProfiles.ratingCount })
      .from(users)
      .innerJoin(workerProfiles, eq(workerProfiles.userId, users.id))
      .orderBy(desc(users.createdAt));
  }
  return db
    .select({ id: users.id, phone: users.phone, status: users.status, businessId: businesses.id, name: businesses.name, type: businesses.type, kycStatus: businesses.kycStatus, ratingSum: businesses.ratingSum, ratingCount: businesses.ratingCount })
    .from(users)
    .innerJoin(businesses, eq(businesses.ownerUserId, users.id))
    .orderBy(desc(users.createdAt));
}

export async function setAccountStatus(db: Db, adminId: string, userId: string, status: 'active' | 'restricted' | 'suspended' | 'banned', note: string) {
  if (!note.trim()) throw bad('note_required', 'Add a note explaining the change.');
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw notFound('Account');
  if (u.role === 'admin') throw conflict('admin_account', 'Admin accounts cannot be changed here.');
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status }).where(eq(users.id, userId));
    await audit(tx, adminId, `account_${status}`, userId, { from: u.status, note });
  });
  return { status };
}

export async function listStrikes(db: Db, workerId: string) {
  return db.select({ strike: strikes, jobTitle: jobs.title }).from(strikes).leftJoin(jobs, eq(jobs.id, strikes.jobId)).where(eq(strikes.workerId, workerId)).orderBy(desc(strikes.createdAt));
}

/** A genuine emergency: the strike stays on record but no longer counts. */
export async function excuseStrike(db: Db, adminId: string, strikeId: string, note: string) {
  if (!note.trim()) throw bad('note_required', 'Add a note explaining why the strike is excused.');
  const [s] = await db.select().from(strikes).where(eq(strikes.id, strikeId));
  if (!s) throw notFound('Strike');
  if (s.excused) throw conflict('already_excused', 'This strike is already excused.');
  return db.transaction(async (tx) => {
    await tx.update(strikes).set({ excused: true, note }).where(eq(strikes.id, strikeId));
    const standing = await refreshStanding(tx, s.workerId);
    await notify(tx, s.workerId, { title: 'A strike was excused', body: 'The Rozkaam team reviewed your case and removed the strike from your score.', icon: 'heart', tone: 'success', href: '/worker/reliability' });
    await audit(tx, adminId, 'strike_excused', strikeId, { note });
    return standing;
  });
}

// ---------------------------------------------------------------- money and logs
export async function listWithdrawals(db: Db, status: 'requested' | 'paid' | 'rejected' = 'requested') {
  return db
    .select({ withdrawal: withdrawals, workerName: workerProfiles.name, phone: users.phone })
    .from(withdrawals)
    .innerJoin(workerProfiles, eq(workerProfiles.userId, withdrawals.workerId))
    .innerJoin(users, eq(users.id, withdrawals.workerId))
    .where(eq(withdrawals.status, status))
    .orderBy(withdrawals.createdAt);
}

export async function listLedger(db: Db, types?: (typeof ledger.$inferSelect)['type'][]) {
  return db
    .select()
    .from(ledger)
    .where(types?.length ? inArray(ledger.type, types) : undefined)
    .orderBy(desc(ledger.createdAt))
    .limit(500);
}

export async function listAudit(db: Db) {
  return db.select({ entry: auditLog, adminPhone: users.phone }).from(auditLog).innerJoin(users, eq(users.id, auditLog.adminId)).orderBy(desc(auditLog.createdAt)).limit(500);
}

