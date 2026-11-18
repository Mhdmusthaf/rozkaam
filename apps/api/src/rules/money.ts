// Money rules. Amounts are whole paise. GMV, worker payouts and Rozkaam
// revenue are always computed separately and never mixed.

export type CommissionMode = 'on_top' | 'deducted';

export interface Terms {
  payPaise: number; // advertised pay per worker
  commissionBps: number; // 1500 = 15%
  commissionMode: CommissionMode;
}

/** What one filled slot means for each party. */
export function slotMoney(t: Terms) {
  const fee = Math.round((t.payPaise * t.commissionBps) / 10_000);
  return t.commissionMode === 'on_top'
    ? { businessPays: t.payPaise + fee, workerGets: t.payPaise, commission: fee }
    : { businessPays: t.payPaise, workerGets: t.payPaise - fee, commission: fee };
}

/** What the business funds up front for `needed` slots. */
export function fundingTotal(t: Terms, needed: number) {
  const s = slotMoney(t);
  return { perSlot: s, subtotal: t.payPaise * needed, fee: s.businessPays * needed - t.payPaise * needed, total: s.businessPays * needed };
}

/**
 * Settlement when attendance is approved: every worker who worked is paid,
 * Rozkaam keeps its commission on those slots, and unused slots are refunded.
 */
export function settlement(t: Terms, needed: number, worked: number) {
  if (worked < 0 || worked > needed) throw new Error('worked must be between 0 and needed');
  const s = slotMoney(t);
  const funded = s.businessPays * needed;
  const payouts = s.workerGets * worked;
  const commission = s.commission * worked;
  const refund = s.businessPays * (needed - worked);
  // Every paisa funded is accounted for.
  if (payouts + commission + refund !== funded) throw new Error('settlement does not balance');
  return { funded, payouts, commission, refund, gmv: t.payPaise * worked };
}
