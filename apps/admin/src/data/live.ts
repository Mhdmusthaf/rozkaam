// Live data layer: reads the Rozkaam API and maps its answers into the same
// shapes the pages already use for demo data, so the pages barely change.
// Money arrives in paise and is shown in rupees; job times arrive as HH:mm.
import { api } from '../api/client';
import type { AccountStatus, AppStatus, Application, AuditEntry, Business, Db, KycStatus, LedgerEntry, ReqStatus, Requirement, Settings, Strike, Withdrawal, Worker } from './types';

// ---------------------------------------------------------------- API shapes
interface ApiAttendance { id: string; applicationId: string; kind: 'in' | 'out'; at: string; photoKey: string | null; distanceM: number | null; flag: 'none' | 'open' | 'accepted' | 'no_show'; flagReason: string | null; late: boolean }
interface ApiRosterRow { applicationId: string; workerId: string; status: string; name: string; rating: number; jobsDone: number; skills: string[]; activeStrikes: number; reliability: number; appliedAt: string; checkIn: ApiAttendance | null; checkOut: ApiAttendance | null }
interface ApiJob {
  id: string; businessId: string; title: string; category: string; description: string; workDate: string; reportTime: string; startTime: string; endTime: string;
  payPaise: number; needed: number; venue: string; address: string; area: string; dress: string; gender: string; skills: string[]; instructions: string;
  pocName: string; pocPhone: string; urgent: boolean; status: string; commissionBps: number; commissionMode: 'on_top' | 'deducted'; fundedAt: string | null; createdAt: string;
}
interface ApiJobListRow extends ApiJob { business: string; confirmed: number; waiting: number }
interface ApiJobDetail extends ApiJob { roster: ApiRosterRow[] }
interface ApiWorkerProfile {
  userId: string; name: string; dob: string; gender: string; district: string; area: string; skills: string[]; experience: string; idType: string; idNumber: string;
  idPhotoKey: string | null; selfieKey: string | null; upi: string; kycStatus: string; kycNote: string | null; ratingSum: number; ratingCount: number; jobsDone: number; createdAt: string;
}
interface ApiBusiness {
  id: string; ownerUserId: string; name: string; type: string; gstin: string; address: string; district: string; contactName: string; email: string;
  docRegistrationKey: string | null; docIdKey: string | null; kycStatus: string; kycNote: string | null; ratingSum: number; ratingCount: number; createdAt: string;
}
interface ApiWorkerUser { id: string; phone: string; status: AccountStatus; name: string; area: string; kycStatus: string; jobsDone: number; ratingSum: number; ratingCount: number }
interface ApiBusinessUser { id: string; phone: string; status: AccountStatus; businessId: string; name: string; type: string; kycStatus: string; ratingSum: number; ratingCount: number }
interface ApiStrikeRow { strike: { id: string; reason: 'late_cancel' | 'no_show' | 'misconduct'; excused: boolean; note: string | null; createdAt: string }; jobTitle: string | null }
interface ApiWithdrawalRow { withdrawal: { id: string; workerId: string; amountPaise: number; destination: string; status: 'requested' | 'paid' | 'rejected'; reference: string | null; note: string | null; createdAt: string } }
interface ApiLedgerRow { id: string; type: 'funding' | 'payout' | 'commission' | 'refund' | 'withdrawal'; amountPaise: number; jobId: string | null; businessId: string | null; workerId: string | null; ref: string | null; note: string | null; createdAt: string }
interface ApiAuditRow { entry: { id: string; action: string; target: string; detail: unknown; createdAt: string }; adminPhone: string }
interface ApiSettings { commissionBps: number; commissionMode: 'on_top' | 'deducted'; cancelWindowHours: number; radiusKm: number; geofenceM: number; reminderLeadHours: number }
export interface ApiDashboard { gmvPaise: number; revenuePaise: number; payoutsPaise: number; fundedPaise: number; refundedPaise: number; requirementsByStatus: Record<string, number>; noShowRate: number }

// ---------------------------------------------------------------- helpers
const rupees = (paise: number) => paise / 100;
const rating = (sum: number, count: number) => (count ? Math.round((sum / count) * 10) / 10 : 0);
const phoneText = (p: string) => (p.length === 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p);

/** "18:30" -> "6:30 PM", matching how the demo data shows times. */
const clock = (hm: string) => {
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const ageFrom = (dob: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob);
  if (!m) return 0;
  const born = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age--;
  return age;
};

const kyc = (s: string): KycStatus => (s === 'verified' || s === 'rejected' || s === 'pending' ? s : 'none');

// The server keeps two closing states: "completed" (work done, the business has
// not approved attendance yet) and "paid" (settled). The panel's "completed"
// means settled, so unsettled work stays "in progress" here.
const reqStatus = (s: string): ReqStatus => (s === 'paid' ? 'completed' : s === 'completed' ? 'in_progress' : (s as ReqStatus));
const appStatus = (s: string): AppStatus => (s === 'confirmed' ? 'approved' : s === 'cancelled' ? 'withdrawn' : (s as AppStatus));

const STRIKE_REASON = { late_cancel: 'Late cancellation', no_show: 'No-show', misconduct: 'Misconduct' } as const;

/** Runs tasks a few at a time so a long list does not open dozens of connections. */
async function pooled<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- load everything
export interface LiveSnapshot {
  db: Db;
  dashboard: ApiDashboard;
  /** Ids the server needs that the panel's shapes do not carry. */
  refs: { businessOwner: Record<string, string>; flagAttendance: Record<string, string> };
  /** True when the ledger hit the server's 500-row limit, so ledger-derived totals are partial. */
  ledgerTruncated: boolean;
}

const KYC_STATES = ['pending', 'rejected', 'verified'] as const;

export async function loadLive(): Promise<LiveSnapshot> {
  const [dashboard, settings, workerUsers, businessUsers, jobList, ledgerRows, auditRows, workerKyc, businessKyc, withdrawalRows] = await Promise.all([
    api.get<ApiDashboard>('/v1/admin/dashboard'),
    api.get<ApiSettings>('/v1/admin/settings'),
    api.get<ApiWorkerUser[]>('/v1/admin/users/worker'),
    api.get<ApiBusinessUser[]>('/v1/admin/users/business'),
    api.get<ApiJobListRow[]>('/v1/admin/jobs'),
    api.get<ApiLedgerRow[]>('/v1/admin/ledger'),
    api.get<ApiAuditRow[]>('/v1/admin/audit'),
    Promise.all(KYC_STATES.map((s) => api.get<{ profile: ApiWorkerProfile; phone: string }[]>(`/v1/admin/kyc/worker?status=${s}`))).then((x) => x.flat()),
    Promise.all(KYC_STATES.map((s) => api.get<{ business: ApiBusiness; phone: string }[]>(`/v1/admin/kyc/business?status=${s}`))).then((x) => x.flat()),
    Promise.all((['requested', 'paid', 'rejected'] as const).map((s) => api.get<ApiWithdrawalRow[]>(`/v1/admin/withdrawals?status=${s}`))).then((x) => x.flat()),
  ]);

  // One call per requirement for its roster, and one per worker for strikes.
  const details = await pooled(jobList, 6, (j) => api.get<ApiJobDetail>(`/v1/admin/jobs/${j.id}`));
  const strikeLists = await pooled(workerUsers, 6, (w) => api.get<ApiStrikeRow[]>(`/v1/admin/workers/${w.id}/strikes`));

  // ---- workers
  const profileOf = new Map(workerKyc.map((r) => [r.profile.userId, r.profile]));
  const workers: Worker[] = workerUsers.map((u, i) => {
    const p = profileOf.get(u.id);
    const strikes: Strike[] = (strikeLists[i] ?? []).map((s) => ({ id: s.strike.id, date: s.strike.createdAt, reason: STRIKE_REASON[s.strike.reason], requirement: s.jobTitle ?? '—', excused: s.strike.excused, note: s.strike.note ?? undefined }));
    return {
      id: u.id,
      name: u.name || 'Unnamed worker',
      phone: phoneText(u.phone),
      area: u.area || '—',
      district: p?.district || '—',
      gender: p?.gender === 'Female' ? 'Female' : 'Male',
      age: p ? ageFrom(p.dob) : 0,
      skills: p?.skills ?? [],
      experience: p?.experience || '—',
      rating: rating(u.ratingSum, u.ratingCount),
      ratingCount: u.ratingCount,
      jobsDone: u.jobsDone,
      reliability: Math.max(0, 100 - strikes.filter((s) => !s.excused).length * 8),
      strikes,
      status: u.status,
      kyc: kyc(u.kycStatus),
      kycDocType: p?.idType || 'ID',
      kycDocLast4: p?.idNumber ? p.idNumber.replace(/\s/g, '').slice(-4) : '—',
      kycSubmitted: p?.createdAt ?? new Date(0).toISOString(),
      kycRejectReason: p?.kycNote ?? undefined,
      upi: p?.upi || '—',
      joined: p?.createdAt ?? new Date(0).toISOString(),
      idPhotoKey: p?.idPhotoKey ?? undefined,
      selfieKey: p?.selfieKey ?? undefined,
    };
  });
  const knownWorker = new Set(workers.map((w) => w.id));

  // ---- businesses
  const bizOf = new Map(businessKyc.map((r) => [r.business.id, r.business]));
  const businessOwner: Record<string, string> = {};
  const businesses: Business[] = businessUsers.map((u) => {
    const b = bizOf.get(u.businessId);
    businessOwner[u.businessId] = u.id;
    return {
      id: u.businessId,
      name: u.name || 'Unnamed business',
      category: u.type || '—',
      gstin: b?.gstin || '—',
      address: b?.address || '—',
      area: b?.district || '—',
      contactName: b?.contactName || '—',
      contactPhone: phoneText(u.phone),
      email: b?.email || '—',
      rating: rating(u.ratingSum, u.ratingCount),
      ratingCount: u.ratingCount,
      status: u.status,
      kyc: kyc(u.kycStatus),
      kycSubmitted: b?.createdAt ?? new Date(0).toISOString(),
      kycRejectReason: b?.kycNote ?? undefined,
      docs: [b?.docRegistrationKey && 'Registration proof', b?.docIdKey && 'Signatory ID'].filter((x): x is string => !!x),
      docKeys: { 'Registration proof': b?.docRegistrationKey ?? undefined, 'Signatory ID': b?.docIdKey ?? undefined },
      joined: b?.createdAt ?? new Date(0).toISOString(),
    };
  });

  // ---- requirements and applications
  const requirements: Requirement[] = jobList.map((j) => ({
    id: j.id,
    businessId: j.businessId,
    title: j.title,
    category: j.category,
    description: j.description,
    workersNeeded: j.needed,
    venue: j.venue,
    address: [j.address, j.area].filter(Boolean).join(', ') || j.venue,
    date: j.workDate,
    reportTime: clock(j.reportTime),
    startTime: clock(j.startTime),
    endTime: clock(j.endTime),
    pay: rupees(j.payPaise),
    dressCode: j.dress || '—',
    gender: j.gender,
    attributes: 'None',
    skills: j.skills,
    instructions: j.instructions || '—',
    pocName: j.pocName || '—',
    pocPhone: j.pocPhone || '—',
    urgent: j.urgent,
    status: reqStatus(j.status),
    commissionRate: j.commissionBps / 100,
    commissionMode: j.commissionMode,
    funded: !!j.fundedAt,
    createdAt: j.createdAt,
  }));

  const flagAttendance: Record<string, string> = {};
  const applications: Application[] = [];
  for (const d of details) {
    for (const r of d.roster) {
      // A worker on a roster always exists; this only guards against a list that changed between calls.
      if (!knownWorker.has(r.workerId)) {
        knownWorker.add(r.workerId);
        workers.push({ id: r.workerId, name: r.name || 'Worker', phone: '—', area: '—', district: '—', gender: 'Male', age: 0, skills: r.skills, experience: '—', rating: r.rating, ratingCount: 0, jobsDone: r.jobsDone, reliability: r.reliability, strikes: [], status: 'active', kyc: 'verified', kycDocType: 'ID', kycDocLast4: '—', kycSubmitted: r.appliedAt, upi: '—', joined: r.appliedAt });
      }
      // A flag can sit on the check-in or the check-out; the panel shows one per application.
      const flagged = [r.checkIn, r.checkOut].find((a) => a && a.flag !== 'none') ?? null;
      if (flagged) flagAttendance[r.applicationId] = flagged.id;
      applications.push({
        id: r.applicationId,
        reqId: d.id,
        workerId: r.workerId,
        status: appStatus(r.status),
        appliedAt: r.appliedAt,
        distanceKm: -1, // the server does not report applicant distance yet
        checkIn: r.checkIn
          ? {
              time: r.checkIn.at,
              distanceM: (flagged ?? r.checkIn).distanceM ?? -1,
              photo: !!r.checkIn.photoKey,
              photoKey: r.checkIn.photoKey ?? undefined,
              flag: flagged ? (flagged.flagReason === 'No photo' ? 'photo' : 'distance') : undefined,
              reason: flagged?.flagReason ?? undefined,
              resolved: flagged && flagged.flag !== 'open' ? (flagged.flag === 'accepted' ? 'accepted' : 'no_show') : undefined,
            }
          : undefined,
        checkOut: r.checkOut ? { time: r.checkOut.at } : undefined,
      });
    }
  }

  // ---- money
  const payOf = new Map(requirements.map((r) => [r.id, r.pay]));
  const ledger: LedgerEntry[] = ledgerRows
    .filter((l) => l.type !== 'withdrawal') // withdrawals have their own page
    .map((l) => ({
      id: l.id,
      type: l.type as LedgerEntry['type'],
      amount: rupees(l.amountPaise),
      // GMV counts the advertised pay for the slot, whatever the commission mode.
      gross: l.type === 'payout' && l.jobId ? payOf.get(l.jobId) : undefined,
      reqId: l.jobId ?? '',
      businessId: l.businessId ?? undefined,
      workerId: l.workerId ?? undefined,
      date: l.createdAt,
      ref: l.ref ?? l.note ?? '—',
    }));
  const withdrawals: Withdrawal[] = withdrawalRows.map(({ withdrawal: w }) => ({ id: w.id, workerId: w.workerId, amount: rupees(w.amountPaise), upi: w.destination, requestedAt: w.createdAt, status: w.status, ref: w.reference ?? undefined, note: w.note ?? undefined }));

  // ---- audit log, with ids turned back into names where we know them
  const nameOf = new Map<string, string>();
  for (const w of workers) nameOf.set(w.id, w.name);
  for (const b of businesses) nameOf.set(b.id, b.name);
  for (const r of requirements) nameOf.set(r.id, r.title);
  for (const a of applications) nameOf.set(a.id, `${nameOf.get(a.workerId) ?? 'Worker'} → ${nameOf.get(a.reqId) ?? 'requirement'}`);
  for (const w of withdrawals) nameOf.set(w.id, `Withdrawal ₹${w.amount.toLocaleString('en-IN')} · ${nameOf.get(w.workerId) ?? 'worker'}`);
  for (const u of businessUsers) nameOf.set(u.id, u.name);
  const audit: AuditEntry[] = auditRows.map(({ entry, adminPhone }) => ({
    id: entry.id,
    time: entry.createdAt,
    actor: `Ops · ${phoneText(adminPhone)}`,
    action: entry.action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
    target: nameOf.get(entry.target) ?? entry.target,
    detail: detailText(entry.detail),
  }));

  const s: Settings = { commissionRate: settings.commissionBps / 100, commissionMode: settings.commissionMode, cancelWindowHours: settings.cancelWindowHours, radiusKm: settings.radiusKm, geofenceM: settings.geofenceM, reminderHours: settings.reminderLeadHours };

  return { db: { workers, businesses, requirements, applications, withdrawals, ledger, audit, settings: s }, dashboard, refs: { businessOwner, flagAttendance }, ledgerTruncated: ledgerRows.length >= 500 };
}

function detailText(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const d = detail as Record<string, unknown>;
  if (typeof d.note === 'string' && d.note) return d.note;
  const parts = Object.entries(d)
    .filter(([k, v]) => !/Id$/.test(k) && (typeof v === 'string' || typeof v === 'number'))
    .map(([k, v]) => (k === 'amountPaise' ? `₹${(Number(v) / 100).toLocaleString('en-IN')}` : `${k}: ${v}`));
  return parts.length ? parts.join(' · ') : undefined;
}

// ---------------------------------------------------------------- sign-in
export const requestCode = (phone: string) => api.post<{ sandbox: boolean }>('/v1/auth/otp/request', { phone });
export const verifyCode = (phone: string, code: string) => api.post<{ token: string; user: { phone: string } }>('/v1/auth/otp/verify', { phone, code, role: 'admin' });
export const signOut = () => api.post('/v1/auth/sign-out');

// ---------------------------------------------------------------- actions
export const actions = {
  decide: (applicationId: string, decision: 'approve' | 'waitlist' | 'reject') => api.post(`/v1/admin/applications/${applicationId}/decide`, { decision }),
  reviewKyc: (kind: 'worker' | 'business', id: string, approve: boolean, note?: string) => api.post(`/v1/admin/kyc/${kind}/${id}`, { approve, note }),
  setStatus: (userId: string, status: AccountStatus, note: string) => api.post(`/v1/admin/users/${userId}/status`, { status, note }),
  excuseStrike: (strikeId: string, note: string) => api.post(`/v1/admin/strikes/${strikeId}/excuse`, { note }),
  resolveFlag: (attendanceId: string, accept: boolean) => api.post(`/v1/admin/flags/${attendanceId}`, { accept }),
  payWithdrawal: (id: string, reference: string) => api.post(`/v1/admin/withdrawals/${id}`, { paid: true, reference }),
  rejectWithdrawal: (id: string, note: string) => api.post(`/v1/admin/withdrawals/${id}`, { paid: false, note }),
  saveSettings: (s: Settings) =>
    api.put('/v1/admin/settings', { commissionBps: Math.round(s.commissionRate * 100), commissionMode: s.commissionMode, cancelWindowHours: s.cancelWindowHours, radiusKm: s.radiusKm, geofenceM: Math.round(s.geofenceM), reminderLeadHours: s.reminderHours }),
};

/** Every GET the live layer uses. The check script walks this list. */
export const READ_PATHS = [
  '/v1/admin/dashboard',
  '/v1/admin/settings',
  '/v1/admin/users/worker',
  '/v1/admin/users/business',
  '/v1/admin/jobs',
  '/v1/admin/ledger',
  '/v1/admin/audit',
  ...KYC_STATES.flatMap((s) => [`/v1/admin/kyc/worker?status=${s}`, `/v1/admin/kyc/business?status=${s}`]),
  ...['requested', 'paid', 'rejected'].map((s) => `/v1/admin/withdrawals?status=${s}`),
];
