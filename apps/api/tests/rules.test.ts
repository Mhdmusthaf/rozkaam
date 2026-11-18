import { describe, expect, it } from 'vitest';

import { assess, checkInWindow, distanceMeters, isLate } from '../src/rules/attendance';
import { fundingTotal, settlement, slotMoney } from '../src/rules/money';
import { isLateCancel, reliabilityScore, standingFor } from '../src/rules/reliability';

const onTop = { payPaise: 800_00, commissionBps: 1500, commissionMode: 'on_top' as const };
const deducted = { ...onTop, commissionMode: 'deducted' as const };

describe('money', () => {
  it('on top: worker gets full pay, business pays pay + 15%', () => {
    expect(slotMoney(onTop)).toEqual({ businessPays: 920_00, workerGets: 800_00, commission: 120_00 });
    expect(fundingTotal(onTop, 10)).toMatchObject({ subtotal: 8000_00, fee: 1200_00, total: 9200_00 });
  });
  it('deducted: business pays advertised pay, worker gets pay - 15%', () => {
    expect(slotMoney(deducted)).toEqual({ businessPays: 800_00, workerGets: 680_00, commission: 120_00 });
    expect(fundingTotal(deducted, 10).total).toBe(8000_00);
  });
  it('settlement balances to the paisa and refunds unused slots', () => {
    const s = settlement(onTop, 10, 8);
    expect(s).toEqual({ funded: 9200_00, payouts: 6400_00, commission: 960_00, refund: 1840_00, gmv: 6400_00 });
    expect(s.payouts + s.commission + s.refund).toBe(s.funded);
  });
  it('nobody worked: everything is refunded and no revenue is taken', () => {
    expect(settlement(onTop, 5, 0)).toMatchObject({ payouts: 0, commission: 0, refund: 4600_00 });
  });
  it('balances for awkward amounts in both modes', () => {
    for (const mode of ['on_top', 'deducted'] as const)
      for (const pay of [333_33, 799_99, 100_01])
        for (const worked of [0, 1, 7]) {
          const s = settlement({ payPaise: pay, commissionBps: 1750, commissionMode: mode }, 7, worked);
          expect(s.payouts + s.commission + s.refund).toBe(s.funded);
        }
  });
  it('rejects impossible attendance', () => {
    expect(() => settlement(onTop, 5, 6)).toThrow();
  });
});

describe('cancellation and standing', () => {
  const start = new Date('2026-12-01T10:00:00+05:30');
  it('more than 12 hours before is free; inside the window is late', () => {
    expect(isLateCancel(start, new Date('2026-11-30T21:59:00+05:30'), 12)).toBe(false);
    expect(isLateCancel(start, new Date('2026-11-30T22:01:00+05:30'), 12)).toBe(true);
    expect(isLateCancel(start, new Date('2026-12-01T11:00:00+05:30'), 12)).toBe(true);
  });
  it('strikes lower the score and escalate standing, never to a ban', () => {
    expect([0, 1, 2, 3, 20].map(reliabilityScore)).toEqual([100, 92, 84, 76, 0]);
    expect([0, 1, 2, 3, 9].map(standingFor)).toEqual(['active', 'active', 'restricted', 'suspended', 'suspended']);
  });
});

describe('attendance', () => {
  it('measures distance', () => {
    expect(distanceMeters(9.9816, 76.2999, 9.9816, 76.2999)).toBe(0);
    const d = distanceMeters(9.9816, 76.2999, 9.9906, 76.2999); // ~1 km north
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1050);
  });
  it('flags missing photo, missing location and being too far', () => {
    expect(assess({ distanceM: 40, hasPhoto: true, geofenceM: 500 })).toEqual({ flagged: false, reason: null });
    expect(assess({ distanceM: 640, hasPhoto: true, geofenceM: 500 }).reason).toBe('640 m from venue');
    expect(assess({ distanceM: 40, hasPhoto: false, geofenceM: 500 }).reason).toBe('No photo');
    expect(assess({ distanceM: null, hasPhoto: true, geofenceM: 500 }).reason).toBe('No location');
  });
  it('lateness and the check-in window', () => {
    const report = new Date('2026-12-01T09:30:00+05:30');
    const end = new Date('2026-12-01T18:00:00+05:30');
    expect(isLate(new Date('2026-12-01T09:34:00+05:30'), report)).toBe(false);
    expect(isLate(new Date('2026-12-01T09:48:00+05:30'), report)).toBe(true);
    expect(checkInWindow(report, end, new Date('2026-12-01T06:00:00+05:30'))).toBe('too_early');
    expect(checkInWindow(report, end, new Date('2026-12-01T07:00:00+05:30'))).toBe('open');
    expect(checkInWindow(report, end, new Date('2026-12-01T18:30:00+05:30'))).toBe('too_late');
  });
});
