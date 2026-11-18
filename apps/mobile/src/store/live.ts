// Live mode: loads everything for the signed-in person from the API and
// converts it into the shapes the screens already use. Screens never see
// raw API data, so the server can change without touching them.
import { api } from '@/api/client';
import type { Fix } from '@/lib/device';
import type { Application, BizTxn, Category, Company, Job, KycStatus, Notice, Role, RosterEntry, RosterStatus, Session, Strike, WalletTxn, WorkerProfile } from './types';

const rupees = (paise: number) => Math.round(paise) / 100;

/** "HH:mm" in India time for an ISO timestamp. */
const istHM = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(11, 16);

// ---- API shapes (only the fields the app uses) ------------------------------
interface ApiAttendance {
  at: string;
  distanceM: number | null;
  flag: 'none' | 'open' | 'accepted' | 'no_show';
  flagReason: string | null;
  late: boolean;
}
interface ApiJobBase {
  id: string;
  businessId: string;
  title: string;
  category: string;
  description: string;
  workDate: string;
  reportTime: string;
  startTime: string;
  endTime: string;
  needed: number;
  venue: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  dress: string;
  gender: 'Any' | 'Male' | 'Female';
  skills: string[];
  experience: string;
  instructions: string;
  urgent: boolean;
  status: Job['status'];
  createdAt: string;
}
interface ApiWorkerJob extends ApiJobBase {
  workerPayPaise: number;
  slotsLeft: number;
  distanceM: number | null;
  business: { name: string; rating: number };
  contact: { name: string; phone: string } | null;
}
interface ApiRoster {
  applicationId: string;
  status: string;
  name: string;
  rating: number;
  jobsDone: number;
  reliability: number;
  skills: string[];
  checkIn: ApiAttendance | null;
  checkOut: ApiAttendance | null;
  rated: number | null;
}
interface ApiBizJob extends ApiJobBase {
  payPaise: number;
  commissionBps: number;
  commissionMode: 'on_top' | 'deducted';
  pocName: string;
  pocPhone: string;
  confirmed: number;
  applied: number;
  roster?: ApiRoster[];
}
interface ApiApplication {
  id: string;
  jobId: string;
  status: Application['status'];
  appliedAt: string;
  job: ApiWorkerJob;
  checkIn: ApiAttendance | null;
  checkOut: ApiAttendance | null;
  ratedBusiness: number | null;
}

// ---- converters -------------------------------------------------------------
const workerJob = (v: ApiWorkerJob): Job => ({
  id: v.id,
  businessId: v.businessId,
  business: v.business.name,
  businessRating: v.business.rating,
  businessJobs: 0,
  title: v.title,
  category: v.category as Category,
  description: v.description,
  dateISO: v.workDate,
  report: v.reportTime,
  start: v.startTime,
  end: v.endTime,
  // Workers are shown what they will actually receive.
  pay: rupees(v.workerPayPaise),
  needed: v.needed,
  confirmed: v.needed - v.slotsLeft,
  applied: 0,
  venue: v.venue,
  address: v.address,
  area: v.area,
  lat: v.lat,
  lng: v.lng,
  distanceKm: v.distanceM === null ? 0 : Math.round(v.distanceM / 100) / 10,
  dress: v.dress,
  gender: v.gender,
  skills: v.skills,
  experience: v.experience,
  instructions: v.instructions,
  pocName: v.contact?.name ?? '',
  pocPhone: v.contact?.phone ?? '',
  urgent: v.urgent,
  status: v.status,
  roster: [],
  commissionRate: 0,
  commissionMode: 'on_top',
  createdAt: v.createdAt,
});

const ROSTER: RosterStatus[] = ['applied', 'confirmed', 'waitlisted', 'checked_in', 'checked_out', 'no_show', 'paid'];

const rosterEntry = (r: ApiRoster): RosterEntry => ({
  id: r.applicationId,
  name: r.name,
  rating: r.rating,
  jobsDone: r.jobsDone,
  reliability: r.reliability,
  skills: r.skills,
  status: r.status as RosterStatus,
  checkIn: r.checkIn ? istHM(r.checkIn.at) : undefined,
  checkOut: r.checkOut ? istHM(r.checkOut.at) : undefined,
  late: r.checkIn?.late || undefined,
  flag: r.checkIn?.flag === 'open' ? (r.checkIn.flagReason ?? 'Needs review') : undefined,
  rated: r.rated ?? undefined,
});

const bizJob = (v: ApiBizJob, businessName: string, businessRating: number): Job => ({
  id: v.id,
  businessId: 'me',
  business: businessName,
  businessRating,
  businessJobs: 0,
  title: v.title,
  category: v.category as Category,
  description: v.description,
  dateISO: v.workDate,
  report: v.reportTime,
  start: v.startTime,
  end: v.endTime,
  pay: rupees(v.payPaise),
  needed: v.needed,
  confirmed: v.confirmed,
  applied: v.applied,
  venue: v.venue,
  address: v.address,
  area: v.area,
  lat: v.lat,
  lng: v.lng,
  distanceKm: 0,
  dress: v.dress,
  gender: v.gender,
  skills: v.skills,
  experience: v.experience,
  instructions: v.instructions,
  pocName: v.pocName,
  pocPhone: v.pocPhone,
  urgent: v.urgent,
  status: v.status,
  roster: (v.roster ?? []).filter((r) => ROSTER.includes(r.status as RosterStatus)).map(rosterEntry),
  commissionRate: v.commissionBps / 10_000,
  commissionMode: v.commissionMode,
  createdAt: v.createdAt,
});

const att = (a: ApiAttendance | null) => (a ? { at: a.at, photo: null, distanceM: a.distanceM ?? undefined, flagged: a.flag === 'open' } : undefined);

const notice = (role: Role) => (n: { id: string; icon: string; tone: Notice['tone']; title: string; body: string; createdAt: string; read: boolean; href: string | null }): Notice => ({
  id: n.id,
  role,
  icon: n.icon,
  tone: n.tone,
  title: n.title,
  body: n.body,
  at: n.createdAt,
  read: n.read,
  href: n.href ?? undefined,
});

// ---- loaders ----------------------------------------------------------------
export interface LiveData {
  session: Session;
  worker?: WorkerProfile;
  company?: Company;
  jobs: Job[];
  applications: Application[];
  wallet: WalletTxn[];
  bizTxns: BizTxn[];
  notices: Notice[];
  settings: { commissionRate: number; commissionMode: 'on_top' | 'deducted' };
}

interface Me {
  id: string;
  phone: string;
  role: Role | 'admin';
}

const formatPhone = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;

/** Everything the signed-in person's screens need, in one go. */
export async function loadEverything(fix: Fix | null): Promise<LiveData | null> {
  const me = await api<Me>('GET', '/me');
  // The mobile app is for workers and businesses; admins use the web panel.
  if (me.role === 'admin') return null;
  const [pub, notes] = await Promise.all([
    api<{ commissionBps: number; commissionMode: 'on_top' | 'deducted' }>('GET', '/settings/public'),
    api<Parameters<ReturnType<typeof notice>>[0][]>('GET', '/notifications'),
  ]);
  const settings = { commissionRate: pub.commissionBps / 10_000, commissionMode: pub.commissionMode };
  const base = { signedIn: true, role: me.role, phone: formatPhone(me.phone) };
  const notices = notes.map(notice(me.role));

  if (me.role === 'worker') {
    const q = fix ? `?lat=${fix.lat}&lng=${fix.lng}` : '';
    const [p, feed, apps, wallet, strikes] = await Promise.all([
      api<any>('GET', '/worker/profile'),
      api<ApiWorkerJob[]>('GET', `/worker/jobs${q}`),
      api<ApiApplication[]>('GET', '/worker/applications'),
      api<{ history: { id: string; kind: 'earning' | 'withdrawal'; title: string; sub: string; amountPaise: number; at: string; status: WalletTxn['status'] }[] }>('GET', '/worker/wallet'),
      api<{ strike: { id: string; reason: 'late_cancel' | 'no_show' | 'misconduct'; excused: boolean; createdAt: string }; jobTitle: string | null }[]>('GET', '/worker/strikes'),
    ]);
    const kyc = p.kycStatus as KycStatus;
    const worker: WorkerProfile = {
      name: p.name,
      photo: null,
      dob: p.dob,
      gender: p.gender,
      district: p.district,
      area: p.area,
      skills: p.skills,
      experience: p.experience,
      about: p.about,
      idType: p.idType,
      idNumber: p.idNumber,
      idPhoto: null,
      selfie: null,
      bankName: p.bankName,
      accountNumber: p.accountNumber,
      ifsc: p.ifsc,
      upi: p.upi,
      rating: p.rating,
      ratingCount: p.ratingCount,
      jobsDone: p.jobsDone,
      hours: Math.round(p.minutesWorked / 60),
      reliability: p.reliability,
      strikes: strikes.map(
        (s): Strike => ({ id: s.strike.id, reason: s.strike.reason === 'no_show' ? 'No-show' : 'Late cancellation', job: s.jobTitle ?? 'A job', at: s.strike.createdAt, excused: s.strike.excused }),
      ),
    };
    const applied = apps.map((a) => workerJob(a.job));
    return {
      session: { ...base, workerOnboarded: kyc !== 'none' && kyc !== 'rejected', businessOnboarded: false, workerKyc: kyc, businessKyc: 'none' },
      worker,
      jobs: [...feed.map(workerJob), ...applied],
      applications: apps.map((a): Application => ({ id: a.id, jobId: a.jobId, status: a.status, appliedAt: a.appliedAt, checkIn: att(a.checkIn), checkOut: att(a.checkOut), ratedBusiness: a.ratedBusiness ?? undefined })),
      wallet: wallet.history.map((t): WalletTxn => ({ id: t.id, kind: t.kind, title: t.title, sub: t.sub, amount: rupees(t.amountPaise), at: t.at, status: t.status })),
      bizTxns: [],
      notices,
      settings,
    };
  }

  const [b, list, pay] = await Promise.all([
    api<any>('GET', '/business/profile'),
    api<ApiBizJob[]>('GET', '/business/jobs'),
    api<{ transactions: { id: string; type: 'funding' | 'refund'; amountPaise: number; at: string; ref: string | null; note: string | null; jobId: string | null; title: string | null }[] }>('GET', '/business/payments'),
  ]);
  const kyc = b.kycStatus as KycStatus;
  const company: Company = {
    name: b.name,
    type: b.type,
    gstin: b.gstin,
    address: b.address,
    district: b.district,
    contactName: b.contactName,
    contactRole: b.contactRole,
    email: b.email,
    docRegistration: null,
    docId: null,
    rating: b.rating,
    ratingCount: b.ratingCount,
  };
  // The list has no rosters; fetch each requirement's roster.
  const detailed = await Promise.all(list.map((j) => api<ApiBizJob>('GET', `/business/jobs/${j.id}`)));
  return {
    session: { ...base, workerOnboarded: false, businessOnboarded: kyc !== 'none' && kyc !== 'rejected', workerKyc: 'none', businessKyc: kyc },
    company,
    jobs: detailed.map((j) => bizJob(j, b.name, b.rating)),
    applications: [],
    wallet: [],
    bizTxns: pay.transactions.map((t): BizTxn => ({ id: t.id, kind: t.type, title: t.type === 'refund' ? `Refund · ${t.title ?? 'Requirement'}` : (t.title ?? 'Requirement'), sub: t.note ?? '', amount: rupees(t.amountPaise), at: t.at, jobId: t.jobId ?? undefined, invoice: t.type === 'funding' ? (t.ref ?? '') : '' })),
    notices,
    settings,
  };
}
