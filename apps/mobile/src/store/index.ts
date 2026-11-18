// In-memory demo store. Every screen reads and writes through here, so swapping
// these actions for real API calls later does not change the screens.
import { create } from 'zustand';

import { dayISO, hoursUntil, inr, nowHM, time12, uid } from '@/lib/format';
import { emptyCompany, emptyWorker, marketJobs, myRequirements, seedApplications, seedBizTxns, seedCompany, seedNotices, seedWallet, seedWorker } from './seed';
import type { Application, Attendance, BizTxn, Company, Job, Notice, ReqDraft, Role, RosterEntry, Session, WalletTxn, WorkerProfile } from './types';

export * from './types';

/** How long the demo waits before pretending the ops team / company acted. */
const DEMO_DELAY = 5000;
export const CANCEL_WINDOW_HOURS = 12;
export const GEOFENCE_M = 500;

interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'danger' | 'info';
}

interface State {
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
  setRole: (r: Role) => void;
  signIn: (phone: string) => void;
  signOut: () => void;
  demoLogin: (r: Role) => void;
  switchRole: (r: Role) => void;
  showToast: (text: string, tone?: Toast['tone']) => void;
  notify: (n: Omit<Notice, 'id' | 'at' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: (role: Role) => void;

  // worker
  updateWorker: (p: Partial<WorkerProfile>) => void;
  submitWorkerKyc: () => void;
  apply: (jobId: string) => string;
  cancelApplication: (appId: string) => 'cancelled' | 'late_cancel';
  checkIn: (appId: string, a: Attendance) => void;
  checkOut: (appId: string, a: Attendance) => void;
  rateBusiness: (appId: string, stars: number) => void;
  withdraw: (amount: number) => void;

  // business
  updateCompany: (p: Partial<Company>) => void;
  submitBusinessKyc: () => void;
  createRequirement: (d: ReqDraft) => string;
  fund: (jobId: string) => void;
  cancelRequirement: (jobId: string) => void;
  markNoShow: (jobId: string, rosterId: string) => void;
  approveAttendance: (jobId: string) => void;
  rateWorker: (jobId: string, rosterId: string, stars: number) => void;
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

export const useStore = create<State>((set, get) => ({
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
  setRole: (role) => set((s) => ({ session: { ...s.session, role } })),
  // A brand-new account starts with no history; only the public job feed is filled.
  signIn: (phone) =>
    set((s) => ({
      session: { ...s.session, signedIn: true, phone },
      worker: emptyWorker,
      company: emptyCompany,
      jobs: marketJobs.filter((j) => j.status === 'open'),
      applications: [],
      wallet: [],
      bizTxns: [],
      notices: [],
    })),
  signOut: () => set({ session: freshSession, worker: emptyWorker, company: emptyCompany }),
  // The demo account comes with sample history on both sides.
  demoLogin: (role) =>
    set({
      session: { signedIn: true, role, phone: role === 'worker' ? '98470 12345' : '98470 00011', workerOnboarded: true, businessOnboarded: true, workerKyc: 'verified', businessKyc: 'verified' },
      worker: seedWorker,
      company: seedCompany,
      jobs: [...marketJobs, ...myRequirements],
      applications: seedApplications,
      wallet: seedWallet,
      bizTxns: seedBizTxns,
      notices: seedNotices,
    }),
  switchRole: (role) => set((s) => ({ session: { ...s.session, role } })),
  showToast: (text, tone = 'success') => {
    const id = Date.now();
    set({ toast: { id, text, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 2800);
  },
  notify: (n) => set((s) => ({ notices: [{ ...n, id: uid('n'), at: new Date().toISOString(), read: false }, ...s.notices] })),
  markRead: (id) => set((s) => ({ notices: s.notices.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: (role) => set((s) => ({ notices: s.notices.map((n) => (n.role === role ? { ...n, read: true } : n)) })),

  // ---------------------------------------------------------------- worker
  updateWorker: (p) => set((s) => ({ worker: { ...s.worker, ...p } })),
  submitWorkerKyc: () => {
    set((s) => ({ session: { ...s.session, workerOnboarded: true, workerKyc: 'pending' } }));
    // Demo: the ops team approves after a few seconds.
    setTimeout(() => {
      if (get().session.workerKyc !== 'pending') return;
      set((s) => ({ session: { ...s.session, workerKyc: 'verified' } }));
      get().notify({ role: 'worker', icon: 'shield-checkmark', tone: 'success', title: 'Account activated', body: 'Your KYC is verified. You can now apply for jobs.', href: '/worker' });
    }, DEMO_DELAY);
  },
  apply: (jobId) => {
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
  cancelApplication: (appId) => {
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
  checkIn: (appId, a) => {
    const app = get().applications.find((x) => x.id === appId)!;
    const job = get().jobs.find((j) => j.id === app.jobId)!;
    set((s) => ({ applications: patchApp(s.applications, appId, { status: 'checked_in', checkIn: a }) }));
    get().notify({ role: 'worker', icon: 'location', tone: 'success', title: 'Checked in', body: `${job.title} · ${time12(nowHM())}. Have a good shift.`, href: `/worker/gig/${appId}` });
  },
  checkOut: (appId, a) => {
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
  },
  rateBusiness: (appId, stars) => set((s) => ({ applications: patchApp(s.applications, appId, { ratedBusiness: stars }) })),
  withdraw: (amount) => {
    const id = uid('w');
    set((s) => ({ wallet: [{ id, kind: 'withdrawal', title: 'Withdrawal to UPI', sub: s.worker.upi || 'Bank account', amount, at: new Date().toISOString(), status: 'processing' }, ...s.wallet] }));
  },

  // ---------------------------------------------------------------- business
  updateCompany: (p) => set((s) => ({ company: { ...s.company, ...p } })),
  submitBusinessKyc: () => {
    set((s) => ({ session: { ...s.session, businessOnboarded: true, businessKyc: 'pending' } }));
    setTimeout(() => {
      if (get().session.businessKyc !== 'pending') return;
      set((s) => ({ session: { ...s.session, businessKyc: 'verified' } }));
      get().notify({ role: 'business', icon: 'shield-checkmark', tone: 'success', title: 'Company verified', body: 'You can now post workforce requirements.', href: '/business' });
    }, DEMO_DELAY);
  },
  createRequirement: (d) => {
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
      lat: 9.9816,
      lng: 76.2999,
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
  fund: (jobId) => {
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
  },
  cancelRequirement: (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId)!;
    const funded = job.status !== 'awaiting_funding';
    set((s) => ({
      jobs: patchJob(s.jobs, jobId, () => ({ status: 'cancelled' })),
      bizTxns: funded ? [{ id: uid('b'), kind: 'refund', title: `Refund · ${job.title}`, sub: 'Requirement cancelled', amount: jobCost(job).total, at: new Date().toISOString(), jobId, invoice: '' }, ...s.bizTxns] : s.bizTxns,
    }));
  },
  markNoShow: (jobId, rosterId) =>
    set((s) => ({ jobs: patchJob(s.jobs, jobId, (j) => ({ roster: j.roster.map((r) => (r.id === rosterId ? { ...r, status: 'no_show' } : r)) })) })),
  approveAttendance: (jobId) => {
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
  },
  rateWorker: (jobId, rosterId, stars) =>
    set((s) => ({ jobs: patchJob(s.jobs, jobId, (j) => ({ roster: j.roster.map((r) => (r.id === rosterId ? { ...r, rated: stars } : r)) })) })),
}));

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
