// The app's single store. Screens read and change data only through here.
//
// Two modes:
//  - 'live'  — a server is configured (EXPO_PUBLIC_API_URL). Every action calls
//              the Rozkaam API and then reloads from it. The server enforces
//              the rules; this file only passes requests along.
//  - 'demo'  — no server, or "Explore the demo". Everything runs in memory on
//              sample data, with timers standing in for the ops team.
//
// Every action is async and never throws: on failure it shows a message and
// returns null or false, so screens only need to check the result.
import { create } from 'zustand';

import { api, ApiError, hasApi, isLocalUri, loadToken, setToken, uploadPhoto } from '@/api/client';
import { getFix, type Fix } from '@/lib/device';
import { dayISO, hoursUntil, inr, nowHM, time12, uid } from '@/lib/format';
import { loadEverything } from './live';
import { emptyCompany, emptyWorker, marketJobs, myRequirements, seedApplications, seedBizTxns, seedCompany, seedNotices, seedWallet, seedWorker } from './seed';
import type { Application, Attendance, BizTxn, Company, Job, Notice, ReqDraft, Role, RosterEntry, Session, WalletTxn, WorkerProfile } from './types';

export * from './types';

/** How long the demo waits before pretending the ops team / company acted. */
const DEMO_DELAY = 5000;
export const CANCEL_WINDOW_HOURS = 12;
export const GEOFENCE_M = 500;
/** Until venues are pinned on a map, new requirements use central Kochi. */
const DEFAULT_VENUE = { lat: 9.9816, lng: 76.2999 };

interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'danger' | 'info';
}

type Mode = 'demo' | 'live';

interface State {
  mode: Mode;
  ready: boolean; // false until a saved login has been checked at startup
  session: Session;
  worker: WorkerProfile;
  company: Company;
  jobs: Job[];
  applications: Application[];
  wallet: WalletTxn[];
  bizTxns: BizTxn[];
  notices: Notice[];
  settings: { commissionRate: number; commissionMode: 'on_top' | 'deducted' };
  toast: Toast | null;

  // session
  restore: () => Promise<void>;
  refresh: () => Promise<void>;
  setRole: (r: Role) => void;
  requestCode: (phone: string) => Promise<boolean>;
  signIn: (phone: string, code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  demoLogin: (r: Role) => void;
  showToast: (text: string, tone?: Toast['tone']) => void;
  notify: (n: Omit<Notice, 'id' | 'at' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: (role: Role) => void;

  // worker
  updateWorker: (p: Partial<WorkerProfile>) => void; // edits the local draft only
  saveWorker: (p: Partial<WorkerProfile>) => Promise<boolean>;
  submitWorkerKyc: () => Promise<boolean>;
  apply: (jobId: string) => Promise<string | null>;
  cancelApplication: (appId: string) => Promise<'cancelled' | 'late_cancel' | null>;
  checkIn: (appId: string, a: Attendance) => Promise<boolean>;
  checkOut: (appId: string, a: Attendance) => Promise<boolean>;
  rateBusiness: (appId: string, stars: number, tags?: string[], comment?: string) => Promise<boolean>;
  withdraw: (amount: number, to?: 'upi' | 'bank') => Promise<boolean>;

  // business
  updateCompany: (p: Partial<Company>) => void; // edits the local draft only
  saveCompany: (p: Partial<Company>) => Promise<boolean>;
  submitBusinessKyc: () => Promise<boolean>;
  createRequirement: (d: ReqDraft) => Promise<string | null>;
  fund: (jobId: string) => Promise<boolean>;
  cancelRequirement: (jobId: string) => Promise<boolean>;
  markNoShow: (jobId: string, rosterId: string) => Promise<boolean>;
  approveAttendance: (jobId: string) => Promise<boolean>;
  rateWorker: (jobId: string, rosterId: string, stars: number) => Promise<boolean>;
}

const freshSession: Session = { signedIn: false, role: null, phone: '', workerOnboarded: false, businessOnboarded: false, workerKyc: 'none', businessKyc: 'none' };

// ---- money helpers ----------------------------------------------------------
export const reqCost = (pay: number, needed: number, rate: number, mode: 'on_top' | 'deducted') => {
  const subtotal = pay * needed;
  const fee = Math.round(subtotal * rate);
  return mode === 'on_top' ? { subtotal, fee, total: subtotal + fee, workerGets: pay } : { subtotal, fee, total: subtotal, workerGets: Math.round(pay * (1 - rate)) };
};
export const jobCost = (j: Job) => reqCost(j.pay, j.needed, j.commissionRate, j.commissionMode);
export const workerPay = (j: Job) => jobCost(j).workerGets;
export const walletBalance = (w: WalletTxn[]) => w.reduce((s, t) => (t.status === 'rejected' ? s : s + (t.kind === 'earning' ? t.amount : -t.amount)), 0);

const patchJob = (jobs: Job[], id: string, fn: (j: Job) => Partial<Job>) => jobs.map((j) => (j.id === id ? { ...j, ...fn(j) } : j));
const patchApp = (apps: Application[], id: string, p: Partial<Application>) => apps.map((a) => (a.id === id ? { ...a, ...p } : a));

/** The phone's location, asked for once per session and reused for the job feed. */
let fix: Fix | null = null;
let fixAsked = false;

export const useStore = create<State>((set, get) => {
  const live = () => get().mode === 'live';

  /** Runs a server call; on failure shows the server's message and returns null. */
  async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await setToken(null);
        set({ session: freshSession, mode: hasApi ? 'live' : 'demo' });
      }
      get().showToast(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.', 'danger');
      return null;
    }
  }

  /** Reloads everything from the server. Drafts being typed during sign-up are kept. */
  async function reload() {
    const data = await loadEverything(fix);
    if (!data) {
      await setToken(null);
      set({ session: freshSession });
      get().showToast('Admin accounts sign in on the web panel.', 'info');
      return;
    }
    const s = get();
    const draftingWorker = data.session.role === 'worker' && !data.session.workerOnboarded;
    const draftingBusiness = data.session.role === 'business' && !data.session.businessOnboarded;
    set({
      session: data.session,
      worker: draftingWorker ? s.worker : (data.worker ?? s.worker),
      company: draftingBusiness ? s.company : (data.company ?? s.company),
      jobs: data.jobs,
      applications: data.applications,
      wallet: data.wallet,
      bizTxns: data.bizTxns,
      notices: data.notices,
      settings: data.settings,
    });
    // Ask for location once, then reload so the feed shows distances.
    if (data.session.role === 'worker' && data.session.workerKyc === 'verified' && !fixAsked) {
      fixAsked = true;
      getFix().then((f) => {
        if (!f) return;
        fix = f;
        get().refresh();
      });
    }
  }

  /** Does a server action, then reloads. Returns the action's result or null. */
  const act = <T>(fn: () => Promise<T>) =>
    attempt(async () => {
      const r = await fn();
      await reload();
      return r;
    });

  return {
    mode: hasApi ? 'live' : 'demo',
    ready: false,
    session: freshSession,
    worker: emptyWorker,
    company: emptyCompany,
    jobs: [...marketJobs, ...myRequirements],
    applications: seedApplications,
    wallet: seedWallet,
    bizTxns: seedBizTxns,
    notices: seedNotices,
    settings: { commissionRate: 0.15, commissionMode: 'on_top' },
    toast: null,

    // ---------------------------------------------------------------- session
    restore: async () => {
      if (hasApi && (await loadToken())) {
        try {
          set({ mode: 'live' });
          await reload();
        } catch (e) {
          // An expired login is dropped quietly; a network failure keeps the token for next time.
          if (e instanceof ApiError && e.status === 401) await setToken(null);
          set({ session: freshSession });
        }
      }
      set({ ready: true });
    },
    refresh: async () => {
      if (!live() || !get().session.signedIn) return;
      try {
        await reload();
      } catch {
        // Background refresh: stay quiet and try again next time.
      }
    },
    setRole: (role) => set((s) => ({ session: { ...s.session, role } })),
    requestCode: async (phone) => {
      if (!hasApi) return true; // sandbox without a server: any code works
      return (await attempt(() => api('POST', '/auth/otp/request', { phone }))) !== null;
    },
    signIn: async (phone, code) => {
      const role = get().session.role ?? 'worker';
      if (!hasApi) {
        // No server: a brand-new local account with no history.
        set((s) => ({
          mode: 'demo',
          session: { ...s.session, signedIn: true, role, phone: `${phone.slice(0, 5)} ${phone.slice(5)}` },
          worker: emptyWorker,
          company: emptyCompany,
          jobs: marketJobs.filter((j) => j.status === 'open'),
          applications: [],
          wallet: [],
          bizTxns: [],
          notices: [],
        }));
        return true;
      }
      const ok = await attempt(async () => {
        const r = await api<{ token: string }>('POST', '/auth/otp/verify', { phone, code, role });
        await setToken(r.token);
        fixAsked = false;
        set({ mode: 'live', worker: emptyWorker, company: emptyCompany, jobs: [], applications: [], wallet: [], bizTxns: [], notices: [] });
        await reload();
        return true;
      });
      return ok === true;
    },
    signOut: async () => {
      if (live() && get().session.signedIn) await api('POST', '/auth/sign-out').catch(() => {});
      await setToken(null);
      set({ mode: hasApi ? 'live' : 'demo', session: freshSession, worker: emptyWorker, company: emptyCompany });
    },
    // The demo account comes with sample history on both sides and never touches the server.
    demoLogin: (role) =>
      set({
        mode: 'demo',
        session: { signedIn: true, role, phone: role === 'worker' ? '98470 12345' : '98470 00011', workerOnboarded: true, businessOnboarded: true, workerKyc: 'verified', businessKyc: 'verified' },
        worker: seedWorker,
        company: seedCompany,
        jobs: [...marketJobs, ...myRequirements],
        applications: seedApplications,
        wallet: seedWallet,
        bizTxns: seedBizTxns,
        notices: seedNotices,
        settings: { commissionRate: 0.15, commissionMode: 'on_top' },
      }),
    showToast: (text, tone = 'success') => {
      const id = Date.now();
      set({ toast: { id, text, tone } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 3200);
    },
    notify: (n) => set((s) => ({ notices: [{ ...n, id: uid('n'), at: new Date().toISOString(), read: false }, ...s.notices] })),
    markRead: (id) => {
      set((s) => ({ notices: s.notices.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
      if (live()) api('POST', '/notifications/read', { id }).catch(() => {});
    },
    markAllRead: (role) => {
      set((s) => ({ notices: s.notices.map((n) => (n.role === role ? { ...n, read: true } : n)) }));
      if (live()) api('POST', '/notifications/read', {}).catch(() => {});
    },

    // ---------------------------------------------------------------- worker
    updateWorker: (p) => set((s) => ({ worker: { ...s.worker, ...p } })),
    saveWorker: async (p) => {
      if (!live()) {
        set((s) => ({ worker: { ...s.worker, ...p } }));
        return true;
      }
      // Only the fields a verified worker may change themselves.
      const r = await act(async () => {
        const photoKey = isLocalUri(p.photo) ? await uploadPhoto(p.photo) : undefined;
        return api('PUT', '/worker/profile', { name: p.name, district: p.district, area: p.area, about: p.about, skills: p.skills, experience: p.experience, upi: p.upi, ...(photoKey ? { photoKey } : {}) });
      });
      // The photo is not sent back by the server yet, so keep showing the local copy.
      if (r !== null && p.photo) set((s) => ({ worker: { ...s.worker, photo: p.photo ?? null } }));
      return r !== null;
    },
    submitWorkerKyc: async () => {
      if (!live()) {
        set((s) => ({ session: { ...s.session, workerOnboarded: true, workerKyc: 'pending' } }));
        // Demo: the ops team approves after a few seconds.
        setTimeout(() => {
          if (get().session.workerKyc !== 'pending') return;
          set((s) => ({ session: { ...s.session, workerKyc: 'verified' } }));
          get().notify({ role: 'worker', icon: 'shield-checkmark', tone: 'success', title: 'Account activated', body: 'Your KYC is verified. You can now apply for jobs.', href: '/worker' });
        }, DEMO_DELAY);
        return true;
      }
      const w = get().worker;
      const r = await act(async () => {
        const [photoKey, idPhotoKey, selfieKey] = await Promise.all([w.photo, w.idPhoto, w.selfie].map((u) => (isLocalUri(u) ? uploadPhoto(u) : Promise.resolve(null))));
        await api('PUT', '/worker/profile', {
          name: w.name.trim(),
          dob: w.dob,
          gender: w.gender,
          district: w.district,
          area: w.area.trim(),
          skills: w.skills,
          experience: w.experience,
          about: w.about,
          idType: w.idType,
          idNumber: w.idNumber.trim(),
          bankName: w.bankName.trim(),
          accountNumber: w.accountNumber,
          ifsc: w.ifsc,
          upi: w.upi,
          ...(photoKey ? { photoKey } : {}),
          ...(idPhotoKey ? { idPhotoKey } : {}),
          ...(selfieKey ? { selfieKey } : {}),
        });
        return api('POST', '/worker/kyc/submit');
      });
      return r !== null;
    },
    apply: async (jobId) => {
      if (live()) return (await act(() => api<{ id: string }>('POST', `/worker/jobs/${jobId}/apply`)))?.id ?? null;
      const id = uid('a');
      const job = get().jobs.find((j) => j.id === jobId)!;
      set((s) => ({
        applications: [{ id, jobId, status: 'applied', appliedAt: new Date().toISOString() }, ...s.applications],
        jobs: patchJob(s.jobs, jobId, (j) => ({ applied: j.applied + 1 })),
      }));
      get().notify({ role: 'worker', icon: 'paper-plane', tone: 'violet', title: 'Application received', body: `You applied for ${job.title}. The Rozkaam team is reviewing it.`, href: `/worker/gig/${id}` });
      // Demo: the ops team confirms (or waitlists when full) after a few seconds.
      setTimeout(() => {
        const app = get().applications.find((a) => a.id === id);
        const j = get().jobs.find((x) => x.id === jobId);
        if (!app || app.status !== 'applied' || !j) return;
        const full = j.confirmed >= j.needed;
        set((s) => ({
          applications: patchApp(s.applications, id, { status: full ? 'waitlisted' : 'confirmed' }),
          jobs: full ? s.jobs : patchJob(s.jobs, jobId, (x) => ({ confirmed: x.confirmed + 1 })),
        }));
        get().notify(
          full
            ? { role: 'worker', icon: 'hourglass', tone: 'warn', title: "You're on the waitlist", body: `${j.title} is full. We will confirm you if a slot opens.`, href: `/worker/gig/${id}` }
            : { role: 'worker', icon: 'checkmark-circle', tone: 'success', title: "You're confirmed", body: `${j.title} at ${j.venue}. Report by ${time12(j.report)}.`, href: `/worker/gig/${id}` },
        );
        get().showToast(full ? 'Added to the waitlist' : `Confirmed: ${j.title}`, full ? 'info' : 'success');
      }, DEMO_DELAY);
      return id;
    },
    cancelApplication: async (appId) => {
      if (live()) return (await act(() => api<{ status: 'cancelled' | 'late_cancel' }>('POST', `/worker/applications/${appId}/cancel`)))?.status ?? null;
      const app = get().applications.find((a) => a.id === appId)!;
      const job = get().jobs.find((j) => j.id === app.jobId)!;
      const wasConfirmed = app.status === 'confirmed';
      const late = wasConfirmed && hoursUntil(job.dateISO, job.start) < CANCEL_WINDOW_HOURS;
      const status = late ? 'late_cancel' : 'cancelled';
      set((s) => ({
        applications: patchApp(s.applications, appId, { status }),
        jobs: patchJob(s.jobs, job.id, (j) => ({ applied: Math.max(0, j.applied - 1), confirmed: wasConfirmed ? Math.max(0, j.confirmed - 1) : j.confirmed })),
        worker: late
          ? { ...s.worker, reliability: Math.max(0, s.worker.reliability - 8), strikes: [{ id: uid('s'), reason: 'Late cancellation', job: job.title, at: new Date().toISOString(), excused: false }, ...s.worker.strikes] }
          : s.worker,
      }));
      return status;
    },
    checkIn: async (appId, a) => {
      if (live()) {
        const r = await act(async () => {
          const photoKey = isLocalUri(a.photo) ? await uploadPhoto(a.photo) : null;
          return api('POST', `/worker/applications/${appId}/check-in`, { photoKey, lat: a.lat ?? null, lng: a.lng ?? null });
        });
        return r !== null;
      }
      const app = get().applications.find((x) => x.id === appId)!;
      const job = get().jobs.find((j) => j.id === app.jobId)!;
      set((s) => ({ applications: patchApp(s.applications, appId, { status: 'checked_in', checkIn: a }) }));
      get().notify({ role: 'worker', icon: 'location', tone: 'success', title: 'Checked in', body: `${job.title} · ${time12(nowHM())}. Have a good shift.`, href: `/worker/gig/${appId}` });
      return true;
    },
    checkOut: async (appId, a) => {
      if (live()) {
        const r = await act(async () => {
          const photoKey = isLocalUri(a.photo) ? await uploadPhoto(a.photo) : null;
          return api('POST', `/worker/applications/${appId}/check-out`, { photoKey, lat: a.lat ?? null, lng: a.lng ?? null });
        });
        return r !== null;
      }
      const app = get().applications.find((x) => x.id === appId)!;
      const job = get().jobs.find((j) => j.id === app.jobId)!;
      set((s) => ({ applications: patchApp(s.applications, appId, { status: 'checked_out', checkOut: a }) }));
      // Demo: the company completes the payout after a few seconds.
      setTimeout(() => {
        if (get().applications.find((x) => x.id === appId)?.status !== 'checked_out') return;
        const amount = workerPay(job);
        set((s) => ({
          applications: patchApp(s.applications, appId, { status: 'paid' }),
          wallet: [{ id: uid('w'), kind: 'earning', title: job.title, sub: job.business, amount, at: new Date().toISOString(), status: 'completed' }, ...s.wallet],
          worker: { ...s.worker, jobsDone: s.worker.jobsDone + 1 },
        }));
        get().notify({ role: 'worker', icon: 'wallet', tone: 'success', title: `${inr(amount)} added to your wallet`, body: `${job.business} completed the payout for ${job.title}.`, href: '/worker/payments' });
        get().showToast(`${inr(amount)} added to your wallet`);
      }, DEMO_DELAY + 2000);
      return true;
    },
    rateBusiness: async (appId, stars, tags = [], comment = '') => {
      if (live()) return (await act(() => api('POST', `/worker/applications/${appId}/rate`, { stars, tags, comment }))) !== null;
      set((s) => ({ applications: patchApp(s.applications, appId, { ratedBusiness: stars }) }));
      return true;
    },
    withdraw: async (amount, to) => {
      if (live()) return (await act(() => api('POST', '/worker/withdrawals', { amountPaise: Math.round(amount * 100), to: to ?? (get().worker.upi ? 'upi' : 'bank') }))) !== null;
      set((s) => ({ wallet: [{ id: uid('w'), kind: 'withdrawal', title: 'Withdrawal to UPI', sub: s.worker.upi || 'Bank account', amount, at: new Date().toISOString(), status: 'processing' }, ...s.wallet] }));
      return true;
    },

    // ---------------------------------------------------------------- business
    updateCompany: (p) => set((s) => ({ company: { ...s.company, ...p } })),
    saveCompany: async (p) => {
      if (!live()) {
        set((s) => ({ company: { ...s.company, ...p } }));
        return true;
      }
      // Registered name, GSTIN and documents are locked after verification.
      return (await act(() => api('PUT', '/business/profile', { type: p.type, address: p.address, district: p.district, contactName: p.contactName, contactRole: p.contactRole, email: p.email }))) !== null;
    },
    submitBusinessKyc: async () => {
      if (!live()) {
        set((s) => ({ session: { ...s.session, businessOnboarded: true, businessKyc: 'pending' } }));
        setTimeout(() => {
          if (get().session.businessKyc !== 'pending') return;
          set((s) => ({ session: { ...s.session, businessKyc: 'verified' } }));
          get().notify({ role: 'business', icon: 'shield-checkmark', tone: 'success', title: 'Company verified', body: 'You can now post workforce requirements.', href: '/business' });
        }, DEMO_DELAY);
        return true;
      }
      const c = get().company;
      const r = await act(async () => {
        const [docRegistrationKey, docIdKey] = await Promise.all([c.docRegistration, c.docId].map((u) => (isLocalUri(u) ? uploadPhoto(u) : Promise.resolve(null))));
        await api('PUT', '/business/profile', {
          name: c.name.trim(),
          type: c.type,
          gstin: c.gstin,
          address: c.address.trim(),
          district: c.district,
          contactName: c.contactName.trim(),
          contactRole: c.contactRole,
          email: c.email,
          ...(docRegistrationKey ? { docRegistrationKey } : {}),
          ...(docIdKey ? { docIdKey } : {}),
        });
        return api('POST', '/business/kyc/submit');
      });
      return r !== null;
    },
    createRequirement: async (d) => {
      if (live()) {
        const r = await act(() =>
          api<{ id: string }>('POST', '/business/jobs', {
            title: d.title.trim(),
            category: d.category,
            description: d.description,
            workDate: d.dateISO,
            reportTime: d.report,
            startTime: d.start,
            endTime: d.end,
            payPaise: Math.round(d.pay * 100),
            needed: d.needed,
            venue: d.venue.trim(),
            address: d.address,
            area: d.area,
            ...DEFAULT_VENUE,
            dress: d.dress,
            gender: d.gender,
            skills: d.skills,
            experience: d.experience,
            instructions: d.instructions,
            pocName: d.pocName,
            pocPhone: d.pocPhone,
            urgent: d.urgent,
          }),
        );
        return r?.id ?? null;
      }
      const id = uid('m');
      const { company, settings } = get();
      const job: Job = {
        ...d,
        id,
        businessId: 'me',
        business: company.name || 'Your company',
        businessRating: company.rating,
        businessJobs: 0,
        confirmed: 0,
        applied: 0,
        ...DEFAULT_VENUE,
        distanceKm: 0,
        status: 'awaiting_funding',
        roster: [],
        commissionRate: settings.commissionRate,
        commissionMode: settings.commissionMode,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ jobs: [job, ...s.jobs] }));
      return id;
    },
    fund: async (jobId) => {
      if (live()) return (await act(() => api('POST', `/business/jobs/${jobId}/fund`))) !== null;
      const job = get().jobs.find((j) => j.id === jobId)!;
      const c = jobCost(job);
      const feeNote = job.commissionMode === 'on_top' ? ` + ${Math.round(job.commissionRate * 100)}% fee` : '';
      set((s) => ({
        jobs: patchJob(s.jobs, jobId, () => ({ status: 'open' })),
        bizTxns: [{ id: uid('b'), kind: 'funding', title: job.title, sub: `${job.needed} workers × ${inr(job.pay)}${feeNote}`, amount: c.total, at: new Date().toISOString(), jobId, invoice: `RZK-INV-${String(42 + s.bizTxns.length).padStart(4, '0')}` }, ...s.bizTxns],
      }));
      get().notify({ role: 'business', icon: 'megaphone', tone: 'violet', title: 'Requirement is live', body: `${job.title} is now visible to nearby workers.`, href: `/business/requirement/${jobId}` });
      // Demo: workers apply and the ops team confirms some of them.
      const names = ['Akhil Raj', 'Sneha Pillai', 'Rahul Krishnan', 'Fathima Nazar', 'Vishnu Prasad', 'Anjali Varma'];
      const mk = (i: number, status: RosterEntry['status']): RosterEntry => ({ id: uid('r'), name: names[i % names.length]!, rating: 4.4 + (i % 5) * 0.1, jobsDone: 6 + i * 7, reliability: 90 + (i % 4) * 3, skills: job.skills.slice(0, 2), status });
      setTimeout(() => {
        const n = Math.min(job.needed, 4);
        set((s) => ({ jobs: patchJob(s.jobs, jobId, (j) => (j.status === 'open' ? { applied: n, roster: Array.from({ length: n }, (_, i) => mk(i, 'applied')) } : {})) }));
      }, DEMO_DELAY);
      setTimeout(() => {
        const j = get().jobs.find((x) => x.id === jobId);
        if (!j || j.status !== 'open' || !j.roster.length) return;
        const k = Math.min(j.roster.length, Math.max(1, Math.ceil(j.needed / 2)));
        set((s) => ({ jobs: patchJob(s.jobs, jobId, (x) => ({ confirmed: k, status: k >= x.needed ? 'filled' : 'open', roster: x.roster.map((r, i) => (i < k ? { ...r, status: 'confirmed' } : r)) })) }));
        get().notify({ role: 'business', icon: 'people', tone: 'success', title: `${k} workers confirmed`, body: `Rozkaam confirmed ${k} of ${j.needed} for ${j.title}.`, href: `/business/requirement/${jobId}` });
      }, DEMO_DELAY * 2);
      return true;
    },
    cancelRequirement: async (jobId) => {
      if (live()) return (await act(() => api('POST', `/business/jobs/${jobId}/cancel`))) !== null;
      const job = get().jobs.find((j) => j.id === jobId)!;
      const funded = job.status !== 'awaiting_funding';
      set((s) => ({
        jobs: patchJob(s.jobs, jobId, () => ({ status: 'cancelled' })),
        bizTxns: funded ? [{ id: uid('b'), kind: 'refund', title: `Refund · ${job.title}`, sub: 'Requirement cancelled', amount: jobCost(job).total, at: new Date().toISOString(), jobId, invoice: '' }, ...s.bizTxns] : s.bizTxns,
      }));
      return true;
    },
    markNoShow: async (jobId, rosterId) => {
      // In live mode a roster entry's id is its application id.
      if (live()) return (await act(() => api('POST', `/business/applications/${rosterId}/no-show`))) !== null;
      set((s) => ({ jobs: patchJob(s.jobs, jobId, (j) => ({ roster: j.roster.map((r) => (r.id === rosterId ? { ...r, status: 'no_show' } : r)) })) }));
      return true;
    },
    approveAttendance: async (jobId) => {
      if (live()) return (await act(() => api('POST', `/business/jobs/${jobId}/approve-attendance`))) !== null;
      const job = get().jobs.find((j) => j.id === jobId)!;
      const worked = job.roster.filter((r) => r.status === 'checked_out' || r.status === 'checked_in').length;
      const unused = job.needed - worked;
      const perWorker = Math.round(jobCost(job).total / job.needed);
      set((s) => ({
        jobs: patchJob(s.jobs, jobId, (j) => ({
          status: 'paid',
          roster: j.roster.map((r) => (r.status === 'checked_out' || r.status === 'checked_in' ? { ...r, status: 'paid', checkOut: r.checkOut ?? j.end } : r)),
        })),
        bizTxns:
          unused > 0
            ? [{ id: uid('b'), kind: 'refund', title: `Refund · ${job.title}`, sub: `${unused} unused ${unused === 1 ? 'slot' : 'slots'}`, amount: unused * perWorker, at: new Date().toISOString(), jobId, invoice: '' }, ...s.bizTxns]
            : s.bizTxns,
      }));
      get().notify({ role: 'business', icon: 'cash', tone: 'success', title: 'Pay released', body: `${worked} workers were paid for ${job.title}.${unused > 0 ? ` ${inr(unused * perWorker)} refunded for unused slots.` : ''}`, href: `/business/requirement/${jobId}` });
      return true;
    },
    rateWorker: async (jobId, rosterId, stars) => {
      if (live()) return (await act(() => api('POST', `/business/applications/${rosterId}/rate`, { stars }))) !== null;
      set((s) => ({ jobs: patchJob(s.jobs, jobId, (j) => ({ roster: j.roster.map((r) => (r.id === rosterId ? { ...r, rated: stars } : r)) })) }));
      return true;
    },
  };
});

// ---- selectors --------------------------------------------------------------
export const useJob = (id?: string) => useStore((s) => s.jobs.find((j) => j.id === id));
export const useUnread = (role: Role) => useStore((s) => s.notices.filter((n) => n.role === role && !n.read).length);

/** The gig the worker should act on right now (check in or check out), if any. */
export const pickActiveGig = (apps: Application[], jobs: Job[]) => {
  const today = dayISO();
  const withJob = apps.map((a) => ({ app: a, job: jobs.find((j) => j.id === a.jobId)! })).filter((x) => x.job);
  return withJob.find((x) => x.app.status === 'checked_in') ?? withJob.find((x) => x.app.status === 'confirmed' && x.job.dateISO === today) ?? null;
};

export const appMeta: Record<Application['status'], { label: string; tone: 'violet' | 'success' | 'warn' | 'danger' | 'info' | 'neutral'; step: number }> = {
  applied: { label: 'Applied · pending', tone: 'warn', step: 0 },
  waitlisted: { label: 'Waitlisted', tone: 'info', step: 0 },
  rejected: { label: 'Not selected', tone: 'neutral', step: 0 },
  confirmed: { label: 'Confirmed', tone: 'success', step: 1 },
  checked_in: { label: 'Checked in', tone: 'violet', step: 2 },
  checked_out: { label: 'Completed · pay pending', tone: 'info', step: 3 },
  paid: { label: 'Paid', tone: 'success', step: 4 },
  cancelled: { label: 'Cancelled', tone: 'neutral', step: 0 },
  late_cancel: { label: 'Late cancellation', tone: 'danger', step: 0 },
  no_show: { label: 'No-show', tone: 'danger', step: 0 },
};

export const reqMeta: Record<Job['status'], { label: string; tone: 'violet' | 'success' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  awaiting_funding: { label: 'Awaiting funding', tone: 'warn' },
  open: { label: 'Open · hiring', tone: 'violet' },
  filled: { label: 'Team confirmed', tone: 'success' },
  in_progress: { label: 'In progress', tone: 'info' },
  completed: { label: 'Approve attendance', tone: 'warn' },
  paid: { label: 'Completed · paid', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
