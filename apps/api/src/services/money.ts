// Worker wallet, withdrawals, and the business payment history.
// Balances are always derived from the ledger and withdrawals, never stored.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { schema, type Db, type Tx } from '../db/client';
import { now } from '../lib/clock';
import { bad, conflict, notFound } from '../lib/errors';
import { audit, getSettings, notify } from './core';

const { ledger, withdrawals, workerProfiles, businesses, jobs } = schema;

const sum = async (db: Tx, where: ReturnType<typeof and>) => {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${ledger.amountPaise}), 0)::int` }).from(ledger).where(where);
  return r?.n ?? 0;
};

export async function walletSummary(db: Tx, workerId: string) {
  const earned = await sum(db, and(eq(ledger.workerId, workerId), eq(ledger.type, 'payout')));
  const [w] = await db
    .select({
      held: sql<number>`coalesce(sum(${withdrawals.amountPaise}) filter (where ${withdrawals.status} = 'requested'), 0)::int`,
      paid: sql<number>`coalesce(sum(${withdrawals.amountPaise}) filter (where ${withdrawals.status} = 'paid'), 0)::int`,
    })
    .from(withdrawals)
    .where(eq(withdrawals.workerId, workerId));
  const held = w?.held ?? 0;
  const paid = w?.paid ?? 0;
  // Money in a pending withdrawal is no longer available.
  return { earnedPaise: earned, withdrawnPaise: paid, processingPaise: held, balancePaise: earned - paid - held };
}

export async function walletHistory(db: Db, workerId: string) {
  const payouts = await db
    .select({ id: ledger.id, amountPaise: ledger.amountPaise, at: ledger.createdAt, title: jobs.title, business: businesses.name })
    .from(ledger)
    .leftJoin(jobs, eq(jobs.id, ledger.jobId))
    .leftJoin(businesses, eq(businesses.id, ledger.businessId))
    .where(and(eq(ledger.workerId, workerId), eq(ledger.type, 'payout')));
  const outs = await db.select().from(withdrawals).where(eq(withdrawals.workerId, workerId));
  return [
    ...payouts.map((p) => ({ id: p.id, kind: 'earning' as const, title: p.title ?? 'Earning', sub: p.business ?? '', amountPaise: p.amountPaise, at: p.at, status: 'completed' as const })),
    ...outs.map((o) => ({ id: o.id, kind: 'withdrawal' as const, title: 'Withdrawal', sub: o.destination, amountPaise: o.amountPaise, at: o.createdAt, status: o.status === 'requested' ? ('processing' as const) : o.status === 'paid' ? ('completed' as const) : ('rejected' as const) })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function requestWithdrawal(db: Db, workerId: string, amountPaise: number, to: 'upi' | 'bank') {
  const s = await getSettings(db);
  if (!Number.isInteger(amountPaise) || amountPaise < s.minWithdrawalPaise) throw bad('below_minimum', `The minimum withdrawal is ₹${s.minWithdrawalPaise / 100}.`);
  const [p] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, workerId));
  if (!p) throw notFound('Worker profile');
  const destination = to === 'upi' ? p.upi : p.accountNumber ? `Bank ••••${p.accountNumber.slice(-4)}` : '';
  if (!destination) throw bad('no_destination', to === 'upi' ? 'Add a UPI ID to your profile first.' : 'Add bank details to your profile first.');
  // Check the balance and create the request together so two requests cannot both pass.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from ${workerProfiles} where ${workerProfiles.userId} = ${workerId} for update`);
    const { balancePaise } = await walletSummary(tx, workerId);
    if (amountPaise > balancePaise) throw bad('insufficient', `You can withdraw up to ₹${balancePaise / 100}.`);
    const [w] = await tx.insert(withdrawals).values({ workerId, amountPaise, destination }).returning();
    return w!;
  });
}

/** The ops team sends the money, then records it here (or rejects the request). */
export async function decideWithdrawal(db: Db, adminId: string, withdrawalId: string, decision: { paid: true; reference: string } | { paid: false; note: string }) {
  const [w] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId));
  if (!w) throw notFound('Withdrawal');
  if (w.status !== 'requested') throw conflict('already_decided', 'This withdrawal has already been handled.');
  return db.transaction(async (tx) => {
    if (decision.paid) {
      if (!decision.reference.trim()) throw bad('reference_required', 'Enter the transfer reference.');
      await tx.update(withdrawals).set({ status: 'paid', reference: decision.reference.trim(), decidedBy: adminId, decidedAt: now() }).where(eq(withdrawals.id, w.id));
      await tx.insert(ledger).values({ type: 'withdrawal', amountPaise: w.amountPaise, workerId: w.workerId, ref: decision.reference.trim() });
      await notify(tx, w.workerId, { title: `₹${w.amountPaise / 100} sent`, body: `Your withdrawal to ${w.destination} is complete.`, icon: 'wallet', tone: 'success', href: '/worker/payments' });
    } else {
      await tx.update(withdrawals).set({ status: 'rejected', note: decision.note, decidedBy: adminId, decidedAt: now() }).where(eq(withdrawals.id, w.id));
      await notify(tx, w.workerId, { title: 'Withdrawal not processed', body: `${decision.note || 'Please check your payout details.'} The money is back in your wallet.`, icon: 'alert-circle', tone: 'warn', href: '/worker/payments' });
    }
    await audit(tx, adminId, decision.paid ? 'withdrawal_paid' : 'withdrawal_rejected', w.id, { amountPaise: w.amountPaise });
    return { status: decision.paid ? 'paid' : 'rejected' };
  });
}

export async function businessPayments(db: Db, ownerUserId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId));
  if (!b) throw notFound('Business');
  const rows = await db
    .select({ id: ledger.id, type: ledger.type, amountPaise: ledger.amountPaise, at: ledger.createdAt, ref: ledger.ref, note: ledger.note, jobId: ledger.jobId, title: jobs.title })
    .from(ledger)
    .leftJoin(jobs, eq(jobs.id, ledger.jobId))
    .where(and(eq(ledger.businessId, b.id), inArray(ledger.type, ['funding', 'refund'])))
    .orderBy(desc(ledger.createdAt));
  const funded = rows.filter((r) => r.type === 'funding').reduce((s, r) => s + r.amountPaise, 0);
  const refunded = rows.filter((r) => r.type === 'refund').reduce((s, r) => s + r.amountPaise, 0);
  return { fundedPaise: funded, refundedPaise: refunded, netSpendPaise: funded - refunded, transactions: rows };
}
