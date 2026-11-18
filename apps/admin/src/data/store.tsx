import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorText, getPhone, getToken, LIVE, onSessionExpired, setSession } from '../api/client';
import { buildDb } from './seed';
import { split } from './format';
import { actions as server, loadLive, requestCode, signOut, verifyCode, type ApiDashboard, type LiveSnapshot } from './live';
import type { AccountStatus, AppStatus, Application, Db, Requirement, Settings, Worker } from './types';

/** What the panel shows in live mode before the first load finishes. */
const emptyDb = (): Db => ({
  workers: [],
  businesses: [],
  requirements: [],
  applications: [],
  withdrawals: [],
  ledger: [],
  audit: [],
  settings: { commissionRate: 15, commissionMode: 'on_top', cancelWindowHours: 12, radiusKm: 15, geofenceM: 500, reminderHours: 2 },
});

const NOT_ON_SERVER = 'This is not available from the server yet.';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'warn' | 'bad';
}

const ACTOR = 'Ops · Demo Admin';

function useStoreValue() {
  // Live mode (VITE_API_URL set) reads and writes through the API.
  // Without it the panel runs on in-memory demo data, exactly as before.
  const [db, setDb] = useState<Db>(() => (LIVE ? emptyDb() : buildDb()));
  const [authed, setAuthed] = useState(() => (LIVE ? !!getToken() : false));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(!LIVE);
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [ledgerTruncated, setLedgerTruncated] = useState(false);
  const refs = useRef<LiveSnapshot['refs']>({ businessOwner: {}, flagAttendance: {} });
  const seq = useRef(100);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  /** Live mode: fetch everything again from the server. */
  const refresh = useCallback(async () => {
    if (!LIVE) return;
    setLoading(true);
    try {
      const snap = await loadLive();
      setDb(snap.db);
      setDashboard(snap.dashboard);
      setLedgerTruncated(snap.ledgerTruncated);
      refs.current = snap.refs;
      setLoaded(true);
    } catch (e) {
      toast(errorText(e), 'bad');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /** Live mode: do one thing on the server, say what happened, then reload. */
  const run = useCallback(
    async (work: () => Promise<unknown>, message: string, tone: Toast['tone'] = 'ok') => {
      try {
        await work();
        toast(message, tone);
        await refresh();
        return true;
      } catch (e) {
        // The server explains why in plain words; show that.
        toast(errorText(e), 'bad');
        await refresh();
        return false;
      }
    },
    [toast, refresh],
  );

  useEffect(() => {
    if (!LIVE) return;
    onSessionExpired(() => {
      setAuthed(false);
      setLoaded(false);
      setDb(emptyDb());
      toast('Your session ended. Sign in again.', 'warn');
    });
    if (getToken()) void refresh();
  }, [refresh, toast]);

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
      /** True when the panel is talking to the real server. */
      live: LIVE,
      loading,
      loaded,
      refresh,
      /** Headline totals straight from the server (live mode only). */
      dashboard,
      ledgerTruncated,
      adminPhone: LIVE ? getPhone() : null,
      /** Things the server cannot do yet are switched off in live mode. */
      can: { replaceWorker: !LIVE, cancelRequirement: !LIVE, seeDistance: !LIVE },

      login: () => setAuthed(true),
      /** Live sign-in, step 1: ask the server to send a code. */
      async requestCode(phone: string) {
        try {
          const r = await requestCode(phone);
          toast(r.sandbox ? 'Sandbox: no SMS is sent. Enter the sandbox code.' : 'Code sent by SMS.', r.sandbox ? 'warn' : 'ok');
          return true;
        } catch (e) {
          toast(errorText(e), 'bad');
          return false;
        }
      },
      /** Live sign-in, step 2: check the code and load the data. */
      async verifyCode(phone: string, code: string) {
        try {
          const r = await verifyCode(phone, code);
          setSession(r.token, r.user.phone);
          setAuthed(true);
          toast('Signed in');
          await refresh();
          return true;
        } catch (e) {
          toast(errorText(e), 'bad');
          return false;
        }
      },
      logout: () => {
        if (LIVE) {
          void signOut().catch(() => undefined);
          setSession(null);
          setLoaded(false);
          setDb(emptyDb());
        }
        setAuthed(false);
      },
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
        if (LIVE) {
          void run(() => server.decide(appId, status === 'approved' ? 'approve' : status === 'waitlisted' ? 'waitlist' : 'reject'), `${verb}: ${worker(a.workerId).name}`, status === 'rejected' ? 'warn' : 'ok');
          return;
        }
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
        if (LIVE) {
          void run(async () => {
            for (const id of ranked) await server.decide(id, 'approve');
          }, `Approved ${ranked.length} ${ranked.length === 1 ? 'applicant' : 'applicants'} for ${r.title}`);
          return;
        }
        act('Bulk-approved applicants', `${ranked.length} workers → ${reqId}`, (d) => syncReq(mapApps(d, (x) => (ranked.includes(x.id) ? { ...x, status: 'approved' } : x)), reqId), {
          detail: 'Ranked by reliability and rating',
        });
      },

      replace(outAppId: string, inAppId: string) {
        if (LIVE) {
          // Needs a server action that removes a confirmed worker; see the API gaps list.
          toast(`Replacing a confirmed worker: ${NOT_ON_SERVER}`, 'warn');
          return;
        }
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
        if (LIVE) {
          // Only the business can cancel on the server today; see the API gaps list.
          toast(`Cancelling from the admin panel: ${NOT_ON_SERVER}`, 'warn');
          return;
        }
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
        if (LIVE) {
          void run(() => server.reviewKyc('worker', id, approve, reason), `${approve ? 'Approved' : 'Rejected'} worker KYC: ${worker(id).name}`, approve ? 'ok' : 'warn');
          return;
        }
        act(approve ? 'Approved worker KYC' : 'Rejected worker KYC', worker(id).name, (d) => ({
          ...d,
          workers: d.workers.map((w) => (w.id === id ? { ...w, kyc: approve ? 'verified' : 'rejected', kycRejectReason: approve ? undefined : reason } : w)),
        }), { detail: reason, tone: approve ? 'ok' : 'warn' });
      },

      reviewBusinessKyc(id: string, approve: boolean, reason?: string) {
        if (LIVE) {
          void run(() => server.reviewKyc('business', id, approve, reason), `${approve ? 'Approved' : 'Rejected'} business KYC: ${business(id).name}`, approve ? 'ok' : 'warn');
          return;
        }
        act(approve ? 'Approved business KYC' : 'Rejected business KYC', business(id).name, (d) => ({
          ...d,
          businesses: d.businesses.map((b) => (b.id === id ? { ...b, kyc: approve ? 'verified' : 'rejected', kycRejectReason: approve ? undefined : reason } : b)),
        }), { detail: reason, tone: approve ? 'ok' : 'warn' });
      },

      setWorkerStatus(id: string, status: AccountStatus, note?: string) {
        const verb = { active: 'Reinstated worker', restricted: 'Restricted worker', suspended: 'Suspended worker', banned: 'Banned worker' }[status];
        if (LIVE) {
          void run(() => server.setStatus(id, status, note ?? ''), `${verb}: ${worker(id).name}`, status === 'active' ? 'ok' : 'warn');
          return;
        }
        act(verb, worker(id).name, (d) => ({ ...d, workers: d.workers.map((w) => (w.id === id ? { ...w, status } : w)) }), { detail: note, tone: status === 'active' ? 'ok' : 'warn' });
      },

      setBusinessStatus(id: string, status: AccountStatus, note?: string) {
        const verb = { active: 'Reinstated business', restricted: 'Restricted business', suspended: 'Suspended business', banned: 'Banned business' }[status];
        if (LIVE) {
          // Account status belongs to the owner's user account, not the business record.
          const ownerId = refs.current.businessOwner[id];
          if (!ownerId) {
            toast('Could not find the account behind this business. Reload and try again.', 'bad');
            return;
          }
          void run(() => server.setStatus(ownerId, status, note ?? ''), `${verb}: ${business(id).name}`, status === 'active' ? 'ok' : 'warn');
          return;
        }
        act(verb, business(id).name, (d) => ({ ...d, businesses: d.businesses.map((b) => (b.id === id ? { ...b, status } : b)) }), { detail: note, tone: status === 'active' ? 'ok' : 'warn' });
      },

      excuseStrike(workerId: string, strikeId: string, note: string) {
        if (LIVE) {
          void run(() => server.excuseStrike(strikeId, note), `Excused strike: ${worker(workerId).name}`);
          return;
        }
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
        if (LIVE) {
          const attendanceId = refs.current.flagAttendance[appId];
          if (!attendanceId) {
            toast('Could not find this flag on the server. Reload and try again.', 'bad');
            return;
          }
          void run(() => server.resolveFlag(attendanceId, outcome === 'accepted'), `${outcome === 'accepted' ? 'Accepted flagged check-in' : 'Marked no-show'}: ${worker(a.workerId).name}`, outcome === 'accepted' ? 'ok' : 'warn');
          return;
        }
        act(outcome === 'accepted' ? 'Accepted flagged check-in' : 'Marked no-show', `${worker(a.workerId).name} (${r.id})`, (d) => ({
          ...mapApps(d, (x) => (x.id === appId ? { ...x, status: outcome === 'no_show' ? 'no_show' : x.status, checkIn: x.checkIn && { ...x.checkIn, resolved: outcome } } : x)),
          workers: outcome === 'no_show' ? d.workers.map((w) => (w.id === a.workerId ? addStrike(w, 'No-show', r.title) : w)) : d.workers,
        }), { tone: outcome === 'accepted' ? 'ok' : 'warn', detail: outcome === 'no_show' ? 'Strike added' : undefined });
      },

      payWithdrawal(id: string, ref: string) {
        const w = db.withdrawals.find((x) => x.id === id)!;
        if (LIVE) {
          void run(() => server.payWithdrawal(id, ref), `Marked withdrawal paid: ${worker(w.workerId).name}`);
          return;
        }
        act('Marked withdrawal paid', id, (d) => ({ ...d, withdrawals: d.withdrawals.map((x) => (x.id === id ? { ...x, status: 'paid', ref } : x)) }), {
          detail: `Ref ${ref} · ${worker(w.workerId).name}`,
        });
      },

      rejectWithdrawal(id: string, note: string) {
        if (LIVE) {
          void run(() => server.rejectWithdrawal(id, note), 'Rejected withdrawal. The money is back in the wallet.', 'warn');
          return;
        }
        act('Rejected withdrawal', id, (d) => ({ ...d, withdrawals: d.withdrawals.map((x) => (x.id === id ? { ...x, status: 'rejected', note } : x)) }), { detail: note, tone: 'warn' });
      },

      saveSettings(s: Settings) {
        if (LIVE) {
          void run(() => server.saveSettings(s), 'Settings saved. They apply to new requirements only.');
          return;
        }
        act('Updated platform settings', `${s.commissionRate}% · ${s.commissionMode === 'on_top' ? 'on top' : 'deducted'}`, (d) => ({ ...d, settings: s }), {
          detail: `Cancel window ${s.cancelWindowHours} h · radius ${s.radiusKm} km · geofence ${s.geofenceM} m · reminder ${s.reminderHours} h`,
          message: 'Settings saved. They apply to new requirements only.',
        });
      },
    };
  }, [db, authed, toasts, toast, act, run, refresh, loading, loaded, dashboard, ledgerTruncated]);
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
  const { db, dashboard } = useStore();
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
    // In live mode the money totals and no-show rate come straight from the
    // server, which counts every ledger row. The rest is derived from loaded data.
    const d = dashboard;
    return {
      gmv: d ? d.gmvPaise / 100 : gmv,
      revenue: d ? d.revenuePaise / 100 : sum('commission'),
      payouts: d ? d.payoutsPaise / 100 : sum('payout'),
      funding: d ? d.fundedPaise / 100 : sum('funding'),
      refunds: d ? d.refundedPaise / 100 : sum('refund'),
      requirements: db.requirements.length,
      fillRate: slots ? Math.round((worked / slots) * 100) : 0,
      noShowRate: d ? Math.round(d.noShowRate * 1000) / 10 : worked + noShows ? Math.round((noShows / (worked + noShows)) * 1000) / 10 : 0,
      activeWorkers: new Set(recent.filter((l) => l.type === 'payout').map((l) => l.workerId)).size,
      activeBusinesses: new Set(recent.filter((l) => l.type === 'funding').map((l) => l.businessId)).size,
      weeks,
    };
  }, [db, dashboard]);
}

export type { Requirement };
