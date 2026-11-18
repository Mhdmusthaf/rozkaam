import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildDb } from './seed';
import { split } from './format';
import type { AccountStatus, AppStatus, Application, Db, Requirement, Settings, Worker } from './types';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'warn' | 'bad';
}

const ACTOR = 'Ops · Demo Admin';

function useStoreValue() {
  const [db, setDb] = useState<Db>(() => buildDb());
  const [authed, setAuthed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(100);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  /** Apply a change, write the audit entry and show a toast, all in one step. */
  const act = useCallback(
    (action: string, target: string, change: (d: Db) => Db, opts: { detail?: string; tone?: Toast['tone']; message?: string } = {}) => {
      setDb((d) => {
        const next = change(d);
        return {
          ...next,
          audit: [{ id: `AU-${++seq.current}`, time: new Date().toISOString(), actor: ACTOR, action, target, detail: opts.detail }, ...next.audit],
        };
      });
      toast(opts.message ?? `${action}: ${target}`, opts.tone ?? 'ok');
    },
    [toast],
  );

  return useMemo(() => {
    const worker = (id: string) => db.workers.find((w) => w.id === id)!;
    const business = (id: string) => db.businesses.find((b) => b.id === id)!;
    const requirement = (id: string) => db.requirements.find((r) => r.id === id);
    const appsFor = (reqId: string) => db.applications.filter((a) => a.reqId === reqId);
    const HOLDING: AppStatus[] = ['approved', 'checked_in', 'checked_out', 'paid'];
    const filled = (reqId: string) => appsFor(reqId).filter((a) => HOLDING.includes(a.status)).length;

    const mapApps = (d: Db, f: (a: Application) => Application) => ({ ...d, applications: d.applications.map(f) });
    /** Keep requirement status in step with how many slots are confirmed. */
    const syncReq = (d: Db, reqId: string): Db => ({
      ...d,
      requirements: d.requirements.map((r) => {
        if (r.id !== reqId || (r.status !== 'open' && r.status !== 'filled')) return r;
        const n = d.applications.filter((a) => a.reqId === reqId && HOLDING.includes(a.status)).length;
        return { ...r, status: n >= r.workersNeeded ? 'filled' : 'open' };
      }),
    });
    const addStrike = (w: Worker, reason: 'No-show' | 'Late cancellation', reqTitle: string): Worker => ({
      ...w,
      reliability: Math.max(0, w.reliability - 12),
      strikes: [...w.strikes, { id: `S-${w.id}-${w.strikes.length + 1}-${Date.now()}`, date: new Date().toISOString(), reason, requirement: reqTitle, excused: false }],
    });

    return {
      db,
      authed,
      toasts,
      toast,
      login: () => setAuthed(true),
      logout: () => setAuthed(false),
      worker,
      business,
      requirement,
      appsFor,
      filled,

      setApplication(appId: string, status: 'approved' | 'waitlisted' | 'rejected') {
        const a = db.applications.find((x) => x.id === appId)!;
        const r = requirement(a.reqId)!;
        if (status === 'approved' && filled(r.id) >= r.workersNeeded) {
          toast(`${r.id} is already full. Waitlist this worker or replace someone.`, 'warn');
          return;
        }
        const verb = status === 'approved' ? 'Approved applicant' : status === 'waitlisted' ? 'Waitlisted applicant' : 'Rejected applicant';
        act(verb, `${worker(a.workerId).name} → ${r.id}`, (d) => syncReq(mapApps(d, (x) => (x.id === appId ? { ...x, status } : x)), r.id), {
          tone: status === 'rejected' ? 'warn' : 'ok',
        });
      },

      bulkApprove(reqId: string, n: number) {
        const r = requirement(reqId)!;
        const room = Math.max(0, r.workersNeeded - filled(reqId));
        const take = Math.min(n, room);
        const ranked = appsFor(reqId)
          .filter((a) => a.status === 'applied' || a.status === 'waitlisted')
          .sort((x, y) => worker(y.workerId).reliability + worker(y.workerId).rating * 4 - (worker(x.workerId).reliability + worker(x.workerId).rating * 4))
          .slice(0, take)
          .map((a) => a.id);
        if (!ranked.length) {
          toast('Nobody left to approve for this requirement.', 'warn');
          return;
        }
        act('Bulk-approved applicants', `${ranked.length} workers → ${reqId}`, (d) => syncReq(mapApps(d, (x) => (ranked.includes(x.id) ? { ...x, status: 'approved' } : x)), reqId), {
          detail: 'Ranked by reliability and rating',
        });
      },

      replace(outAppId: string, inAppId: string) {
        const out = db.applications.find((x) => x.id === outAppId)!;
        const inn = db.applications.find((x) => x.id === inAppId)!;
        act('Replaced worker', `${worker(out.workerId).name} → ${worker(inn.workerId).name} (${out.reqId})`, (d) =>
          syncReq(
            mapApps(d, (x) => (x.id === outAppId ? { ...x, status: 'withdrawn' } : x.id === inAppId ? { ...x, status: 'approved' } : x)),
            out.reqId,
          ),
        );
      },

      cancelRequirement(reqId: string, reason: string) {
        const r = requirement(reqId)!;
        act('Cancelled requirement', reqId, (d) => {
          const sp = split(r.pay, r.commissionRate, r.commissionMode);
          const refund = r.funded
            ? [{ id: `L-${Date.now()}`, type: 'refund' as const, amount: sp.businessPays * r.workersNeeded, reqId, businessId: r.businessId, date: new Date().toISOString(), ref: `RFD${String(Date.now()).slice(-6)}` }]
            : [];
          return {
            ...d,
            requirements: d.requirements.map((x) => (x.id === reqId ? { ...x, status: 'cancelled', cancelReason: reason } : x)),
            applications: d.applications.map((a) => (a.reqId === reqId && ['applied', 'approved', 'waitlisted'].includes(a.status) ? { ...a, status: 'withdrawn' } : a)),
            ledger: [...refund, ...d.ledger],
          };
        }, { detail: reason, tone: 'warn' });
      },

      reviewWorkerKyc(id: string, approve: boolean, reason?: string) {
        act(approve ? 'Approved worker KYC' : 'Rejected worker KYC', worker(id).name, (d) => ({
          ...d,
          workers: d.workers.map((w) => (w.id === id ? { ...w, kyc: approve ? 'verified' : 'rejected', kycRejectReason: approve ? undefined : reason } : w)),
        }), { detail: reason, tone: approve ? 'ok' : 'warn' });
      },

      reviewBusinessKyc(id: string, approve: boolean, reason?: string) {
        act(approve ? 'Approved business KYC' : 'Rejected business KYC', business(id).name, (d) => ({
          ...d,
          businesses: d.businesses.map((b) => (b.id === id ? { ...b, kyc: approve ? 'verified' : 'rejected', kycRejectReason: approve ? undefined : reason } : b)),
        }), { detail: reason, tone: approve ? 'ok' : 'warn' });
      },

      setWorkerStatus(id: string, status: AccountStatus, note?: string) {
        const verb = { active: 'Reinstated worker', restricted: 'Restricted worker', suspended: 'Suspended worker', banned: 'Banned worker' }[status];
        act(verb, worker(id).name, (d) => ({ ...d, workers: d.workers.map((w) => (w.id === id ? { ...w, status } : w)) }), { detail: note, tone: status === 'active' ? 'ok' : 'warn' });
      },

      setBusinessStatus(id: string, status: AccountStatus, note?: string) {
        const verb = { active: 'Reinstated business', restricted: 'Restricted business', suspended: 'Suspended business', banned: 'Banned business' }[status];
        act(verb, business(id).name, (d) => ({ ...d, businesses: d.businesses.map((b) => (b.id === id ? { ...b, status } : b)) }), { detail: note, tone: status === 'active' ? 'ok' : 'warn' });
      },

      excuseStrike(workerId: string, strikeId: string, note: string) {
        act('Excused strike', worker(workerId).name, (d) => ({
          ...d,
          workers: d.workers.map((w) =>
            w.id === workerId
              ? { ...w, reliability: Math.min(100, w.reliability + 12), strikes: w.strikes.map((s) => (s.id === strikeId ? { ...s, excused: true, note } : s)) }
              : w,
          ),
        }), { detail: note });
      },

      resolveFlag(appId: string, outcome: 'accepted' | 'no_show') {
        const a = db.applications.find((x) => x.id === appId)!;
        const r = requirement(a.reqId)!;
        act(outcome === 'accepted' ? 'Accepted flagged check-in' : 'Marked no-show', `${worker(a.workerId).name} (${r.id})`, (d) => ({
          ...mapApps(d, (x) => (x.id === appId ? { ...x, status: outcome === 'no_show' ? 'no_show' : x.status, checkIn: x.checkIn && { ...x.checkIn, resolved: outcome } } : x)),
          workers: outcome === 'no_show' ? d.workers.map((w) => (w.id === a.workerId ? addStrike(w, 'No-show', r.title) : w)) : d.workers,
        }), { tone: outcome === 'accepted' ? 'ok' : 'warn', detail: outcome === 'no_show' ? 'Strike added' : undefined });
      },

      payWithdrawal(id: string, ref: string) {
        const w = db.withdrawals.find((x) => x.id === id)!;
        act('Marked withdrawal paid', id, (d) => ({ ...d, withdrawals: d.withdrawals.map((x) => (x.id === id ? { ...x, status: 'paid', ref } : x)) }), {
          detail: `Ref ${ref} · ${worker(w.workerId).name}`,
        });
      },

      rejectWithdrawal(id: string, note: string) {
        act('Rejected withdrawal', id, (d) => ({ ...d, withdrawals: d.withdrawals.map((x) => (x.id === id ? { ...x, status: 'rejected', note } : x)) }), { detail: note, tone: 'warn' });
      },

      saveSettings(s: Settings) {
        act('Updated platform settings', `${s.commissionRate}% · ${s.commissionMode === 'on_top' ? 'on top' : 'deducted'}`, (d) => ({ ...d, settings: s }), {
          detail: `Cancel window ${s.cancelWindowHours} h · radius ${s.radiusKm} km · geofence ${s.geofenceM} m · reminder ${s.reminderHours} h`,
          message: 'Settings saved. They apply to new requirements only.',
        });
      },
    };
  }, [db, authed, toasts, toast, act]);
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}

/** Headline numbers. GMV, worker payouts and Rozkaam revenue are always kept apart. */
export function useMetrics() {
  const { db } = useStore();
  return useMemo(() => {
    const sum = (t: string) => db.ledger.filter((l) => l.type === t).reduce((n, l) => n + l.amount, 0);
    const payouts = db.ledger.filter((l) => l.type === 'payout');
    const gmv = payouts.reduce((n, l) => n + (l.gross ?? l.amount), 0);
    const done = db.requirements.filter((r) => r.status === 'completed');
    const slots = done.reduce((n, r) => n + r.workersNeeded, 0);
    const doneIds = new Set(done.map((r) => r.id));
    const doneApps = db.applications.filter((a) => doneIds.has(a.reqId));
    const worked = doneApps.filter((a) => a.status === 'paid').length;
    const noShows = doneApps.filter((a) => a.status === 'no_show').length;
    const since = Date.now() - 30 * 86400000;
    const recent = db.ledger.filter((l) => new Date(l.date).getTime() >= since);
    const weeks: { label: string; gmv: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = Date.now() - i * 7 * 86400000;
      const start = end - 7 * 86400000;
      weeks.push({
        label: i === 0 ? 'This wk' : `${i}w ago`,
        gmv: payouts.filter((l) => { const t = new Date(l.date).getTime(); return t > start && t <= end; }).reduce((n, l) => n + (l.gross ?? l.amount), 0),
      });
    }
    return {
      gmv,
      revenue: sum('commission'),
      payouts: sum('payout'),
      funding: sum('funding'),
      refunds: sum('refund'),
      requirements: db.requirements.length,
      fillRate: slots ? Math.round((worked / slots) * 100) : 0,
      noShowRate: worked + noShows ? Math.round((noShows / (worked + noShows)) * 1000) / 10 : 0,
      activeWorkers: new Set(recent.filter((l) => l.type === 'payout').map((l) => l.workerId)).size,
      activeBusinesses: new Set(recent.filter((l) => l.type === 'funding').map((l) => l.businessId)).size,
      weeks,
    };
  }, [db]);
}

export type { Requirement };
