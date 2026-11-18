import type { Application, AuditEntry, Business, Db, LedgerEntry, Requirement, Strike, Withdrawal, Worker } from './types';
import { split } from './format';

/* Deterministic pseudo-random numbers so the demo looks the same on every load. */
let s = 20261118;
const rnd = () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const sample = <T,>(a: T[], n: number) => {
  const c = [...a];
  const out: T[] = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
  return out;
};

const at = (dayOff: number, h = 10, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOff);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const AREAS = ['Kakkanad', 'Edappally', 'Kaloor', 'Vyttila', 'Palarivattom', 'Aluva', 'Fort Kochi', 'Thrippunithura', 'Kalamassery', 'Panampilly Nagar', 'Thevara', 'Angamaly', 'Perumbavoor', 'Marine Drive'];
export const SKILLS = ['Banquet service', 'Catering', 'Event setup', 'Ushering', 'Housekeeping', 'Kitchen help', 'Promotion', 'Crowd management', 'Film extra', 'Billing counter', 'Packing', 'Call handling'];
export const CATEGORIES = ['Events', 'Hospitality', 'Catering', 'Film & entertainment', 'Retail', 'Call centre', 'Logistics'];

const NAMES: [string, 'Male' | 'Female'][] = [
  ['Arjun Menon', 'Male'], ['Anjali Nair', 'Female'], ['Faisal Rahman', 'Male'], ['Sneha Thomas', 'Female'], ['Vishnu Prasad', 'Male'],
  ['Meera Krishnan', 'Female'], ['Jithin Joseph', 'Male'], ['Fathima Shirin', 'Female'], ['Akhil Raj', 'Male'], ['Devika Suresh', 'Female'],
  ['Nikhil Varghese', 'Male'], ['Aswathy Pillai', 'Female'], ['Sharon George', 'Male'], ['Riya Mathew', 'Female'], ['Sanjay Kumar', 'Male'],
  ['Lakshmi Das', 'Female'], ['Abin Paul', 'Male'], ['Neethu Babu', 'Female'], ['Rahul Shaji', 'Male'], ['Amala Jose', 'Female'],
  ['Shameer Ali', 'Male'], ['Gopika Mohan', 'Female'], ['Kiran Sebastian', 'Male'], ['Athira Vijayan', 'Female'], ['Midhun Chandran', 'Male'],
  ['Parvathy Unni', 'Female'], ['Basil Kurian', 'Male'], ['Hridya Anil', 'Female'], ['Noufal Hameed', 'Male'], ['Sandra Philip', 'Female'],
  ['Deepak Soman', 'Male'], ['Keerthana Rajan', 'Female'], ['Ajmal Basheer', 'Male'], ['Tessa Antony', 'Female'], ['Sreerag Mohan', 'Male'],
  ['Aiswarya Gopal', 'Female'], ['Manu Madhavan', 'Male'], ['Nimisha Roy', 'Female'], ['Vivek Narayanan', 'Male'], ['Diya Francis', 'Female'],
];

function buildWorkers(): Worker[] {
  return NAMES.map(([name, gender], i) => {
    const jobsDone = i < 34 ? int(2, 64) : 0;
    const handle = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
    const w: Worker = {
      id: `W-${1001 + i}`,
      name,
      gender,
      age: int(19, 34),
      phone: `+91 9${int(10, 99)}${int(10, 99)} ${int(10000, 99999)}`,
      area: pick(AREAS),
      district: 'Ernakulam',
      skills: sample(SKILLS, int(2, 4)),
      experience: pick(['Less than 1 year', '1–2 years', '2–4 years', '4+ years']),
      rating: jobsDone ? Math.round((3.8 + rnd() * 1.2) * 10) / 10 : 0,
      ratingCount: jobsDone ? Math.max(1, Math.round(jobsDone * 0.7)) : 0,
      jobsDone,
      reliability: jobsDone ? int(82, 100) : 100,
      strikes: [],
      status: 'active',
      kyc: 'verified',
      kycDocType: pick(['Aadhaar', 'Driving licence', 'Voter ID']),
      kycDocLast4: String(int(1000, 9999)),
      kycSubmitted: at(-int(20, 300)),
      upi: `${handle}@upi`,
      joined: at(-int(20, 600)),
    };
    return w;
  });
}

function buildBusinesses(): Business[] {
  const rows: [string, string, string, string, string][] = [
    ['Marina Crest Banquets', 'Hospitality', 'Marine Drive', 'Rekha Varma', 'NH Bypass Road'],
    ['Spice Coast Caterers', 'Catering', 'Edappally', 'Thomas Kuruvilla', 'Changampuzha Park Road'],
    ['Backwater Events Co.', 'Events', 'Panampilly Nagar', 'Nisha Ibrahim', '8th Cross Road'],
    ['Lakeview Convention Hall', 'Events', 'Kakkanad', 'Suresh Pillai', 'Seaport–Airport Road'],
    ['Malabar Frames Productions', 'Film & entertainment', 'Kaloor', 'Roshan Mathew', 'Stadium Link Road'],
    ['Coral Reef Hotel', 'Hospitality', 'Fort Kochi', 'Anita D’Souza', 'Tower Road'],
    ['Harbourline Retail', 'Retail', 'Vyttila', 'Praveen Nambiar', 'Mobility Hub Road'],
    ['Monsoon Weddings & Decor', 'Events', 'Thrippunithura', 'Geetha Raman', 'Hill Palace Road'],
    ['Greenleaf Call Services', 'Call centre', 'Kalamassery', 'Imran Sait', 'HMT Junction'],
    ['Periyar Logistics Hub', 'Logistics', 'Aluva', 'Biju Chacko', 'Companypady'],
    ['Cochin Carnival Events', 'Events', 'Kaloor', 'Leena Sunny', 'Deshabhimani Road'],
    ['Tamarind Tree Kitchen', 'Catering', 'Palarivattom', 'Hari Shankar', 'Civil Line Road'],
    ['Seabreeze Party Rentals', 'Events', 'Thevara', 'Joyal Peter', 'Perumanoor Road'],
  ];
  return rows.map(([name, category, area, contactName, street], i) => {
    const pending = i >= 10;
    return {
      id: `B-${201 + i}`,
      name,
      category,
      gstin: `32${String.fromCharCode(65 + i)}${String.fromCharCode(66 + i)}CDE${int(1000, 9999)}F1Z${int(1, 9)}`,
      address: `${int(2, 88)}, ${street}, ${area}, Kochi`,
      area,
      contactName,
      contactPhone: `+91 9${int(10, 99)}${int(10, 99)} ${int(10000, 99999)}`,
      email: `ops@${name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14)}.example`,
      rating: pending ? 0 : Math.round((4 + rnd() * 0.9) * 10) / 10,
      ratingCount: pending ? 0 : int(6, 48),
      status: 'active' as const,
      kyc: pending ? ('pending' as const) : ('verified' as const),
      kycSubmitted: at(pending ? -int(0, 2) : -int(30, 400), int(9, 18)),
      docs: ['GST certificate', 'Business registration', 'Owner ID'],
      joined: at(pending ? -int(0, 2) : -int(30, 400)),
    };
  });
}

const TITLES: Record<string, [string, string[], string][]> = {
  Events: [
    ['Wedding reception service staff', ['Banquet service', 'Ushering'], 'Black formal shirt and trousers'],
    ['Exhibition stall setup crew', ['Event setup'], 'Plain dark T-shirt, closed shoes'],
    ['Conference ushers', ['Ushering', 'Crowd management'], 'White shirt, black trousers'],
  ],
  Hospitality: [
    ['Banquet service staff', ['Banquet service'], 'Black formal'],
    ['Housekeeping support', ['Housekeeping'], 'Uniform provided at venue'],
  ],
  Catering: [
    ['Catering crew', ['Catering', 'Kitchen help'], 'White shirt, black trousers, hair net'],
    ['Buffet counter servers', ['Catering', 'Banquet service'], 'Black formal'],
  ],
  'Film & entertainment': [['Crowd scene extras', ['Film extra'], 'Casual, no logos']],
  Retail: [['Festival sale floor staff', ['Billing counter', 'Promotion'], 'Smart casual']],
  'Call centre': [['Weekend call handling agents', ['Call handling'], 'Smart casual']],
  Logistics: [['Parcel sorting and packing', ['Packing'], 'Closed shoes, full-length trousers']],
};

export function buildDb(): Db {
  const workers = buildWorkers();
  const businesses = buildBusinesses();
  const verifiedBiz = businesses.filter((b) => b.kyc === 'verified');
  const requirements: Requirement[] = [];
  const applications: Application[] = [];
  const ledger: LedgerEntry[] = [];
  let rid = 1000;
  let aid = 5000;
  let lid = 9000;

  // A few account states and KYC cases so every admin screen has something in it.
  const strike = (w: Worker, dayOff: number, reason: Strike['reason'], requirement: string) =>
    w.strikes.push({ id: `S-${w.id}-${w.strikes.length + 1}`, date: at(dayOff), reason, requirement, excused: false });
  strike(workers[4], -6, 'Late cancellation', 'Banquet service staff');
  strike(workers[8], -12, 'No-show', 'Catering crew');
  strike(workers[8], -3, 'Late cancellation', 'Conference ushers');
  workers[8].status = 'restricted';
  workers[8].reliability = 68;
  strike(workers[14], -30, 'No-show', 'Wedding reception service staff');
  strike(workers[14], -17, 'No-show', 'Buffet counter servers');
  strike(workers[14], -9, 'Late cancellation', 'Catering crew');
  workers[14].status = 'suspended';
  workers[14].reliability = 51;
  strike(workers[20], -44, 'Misconduct', 'Housekeeping support');
  strike(workers[20], -40, 'No-show', 'Banquet service staff');
  workers[20].status = 'banned';
  workers[20].reliability = 30;
  strike(workers[11], -2, 'Late cancellation', 'Exhibition stall setup crew');
  for (let i = 34; i < 39; i++) {
    workers[i].kyc = 'pending';
    workers[i].kycSubmitted = at(-(i - 34) % 3, 9 + (i - 34) * 2);
    workers[i].joined = workers[i].kycSubmitted;
  }
  workers[39].kyc = 'rejected';
  workers[39].kycRejectReason = 'ID photo unreadable';
  const pool = workers.filter((w) => w.kyc === 'verified' && w.status === 'active');

  const addReq = (o: Partial<Requirement> & { dayOff: number; status: Requirement['status']; needed: number; startH?: number }) => {
    const biz = o.businessId ? businesses.find((b) => b.id === o.businessId)! : pick(verifiedBiz);
    const [title, skills, dress] = pick(TITLES[biz.category] ?? TITLES.Events);
    const picked = pick([8, 9, 10, 11, 16, 17, 18]);
    const startH = o.startH ?? picked;
    const endH = Math.min(23, startH + (startH >= 16 ? 5 : 7));
    const clock = (h: number, m: string) => `${((h + 11) % 12) + 1}:${m} ${h % 24 < 12 ? 'AM' : 'PM'}`;
    const pay = pick([700, 750, 800, 800, 800, 850, 900, 1000]);
    const r: Requirement = {
      id: `R-${++rid}`,
      businessId: biz.id,
      title,
      category: biz.category,
      description: `${title} needed at ${biz.name}. Report to the point of contact on arrival for briefing.`,
      workersNeeded: o.needed,
      venue: biz.name,
      address: biz.address,
      date: at(o.dayOff, startH),
      reportTime: clock(Math.max(0, startH - 1), '30'),
      startTime: clock(startH, '00'),
      endTime: clock(endH, '00'),
      pay,
      dressCode: dress,
      gender: 'Any',
      attributes: 'None',
      skills,
      instructions: 'Carry a government ID. Phones on silent during service. Meals provided.',
      pocName: biz.contactName,
      pocPhone: biz.contactPhone,
      urgent: o.dayOff >= 0 && o.dayOff <= 1 && rnd() > 0.5,
      commissionRate: 15,
      commissionMode: 'on_top',
      funded: o.status !== 'awaiting_funding',
      // Posted 2-5 days before the job, but never in the future.
      createdAt: at(Math.min(o.dayOff - int(2, 5), -1), int(9, 19)),
      ...o,
    };
    requirements.push(r);
    const sp = split(r.pay, r.commissionRate, r.commissionMode);
    if (r.funded) {
      ledger.push({ id: `L-${++lid}`, type: 'funding', amount: sp.businessPays * r.workersNeeded, reqId: r.id, businessId: biz.id, date: r.createdAt, ref: `FND${int(100000, 999999)}` });
    }
    return r;
  };

  const addApp = (r: Requirement, w: Worker, status: Application['status'], extra: Partial<Application> = {}) => {
    const a: Application = {
      id: `A-${++aid}`,
      reqId: r.id,
      workerId: w.id,
      status,
      appliedAt: new Date(Math.min(new Date(r.createdAt).getTime() + int(1, 30) * 3600000, Date.now() - int(5, 240) * 60000)).toISOString(),
      distanceKm: Math.round((0.8 + rnd() * 13) * 10) / 10,
      ...extra,
    };
    applications.push(a);
    return a;
  };

  const settle = (r: Requirement, paidWorkers: Worker[]) => {
    const sp = split(r.pay, r.commissionRate, r.commissionMode);
    const when = new Date(new Date(r.date).getTime() + 9 * 3600000).toISOString();
    for (const w of paidWorkers) {
      ledger.push({ id: `L-${++lid}`, type: 'payout', amount: sp.workerGets, gross: r.pay, reqId: r.id, businessId: r.businessId, workerId: w.id, date: when, ref: `PAY${int(100000, 999999)}` });
    }
    ledger.push({ id: `L-${++lid}`, type: 'commission', amount: sp.fee * paidWorkers.length, reqId: r.id, businessId: r.businessId, date: when, ref: `COM${int(100000, 999999)}` });
    const unused = r.workersNeeded - paidWorkers.length;
    if (unused > 0) {
      ledger.push({ id: `L-${++lid}`, type: 'refund', amount: sp.businessPays * unused, reqId: r.id, businessId: r.businessId, date: when, ref: `RFD${int(100000, 999999)}` });
    }
  };

  // Past eight weeks of completed work.
  for (let d = -56; d <= -2; d += 2) {
    const needed = pick([4, 6, 8, 10, 10, 12, 15]);
    const r = addReq({ dayOff: d + int(0, 1), status: 'completed', needed });
    const chosen = sample(pool, needed);
    const paid: Worker[] = [];
    chosen.forEach((w, i) => {
      const noShow = i === 0 && rnd() < 0.2;
      const t = new Date(r.date);
      if (noShow) addApp(r, w, 'no_show');
      else {
        addApp(r, w, 'paid', {
          checkIn: { time: new Date(t.getTime() - int(5, 28) * 60000).toISOString(), distanceM: int(10, 180), photo: true },
          checkOut: { time: new Date(t.getTime() + 7 * 3600000 + int(0, 20) * 60000).toISOString() },
        });
        paid.push(w);
      }
    });
    settle(r, paid);
  }

  // Yesterday: completed, with one late flag still to review.
  {
    const r = addReq({ dayOff: -1, status: 'completed', needed: 8, businessId: 'B-202' });
    const chosen = sample(pool, 8);
    const t = new Date(r.date);
    chosen.forEach((w, i) => {
      addApp(r, w, 'paid', {
        checkIn: i === 2
          ? { time: new Date(t.getTime() - 4 * 60000).toISOString(), distanceM: 1240, photo: true, flag: 'distance' }
          : { time: new Date(t.getTime() - int(6, 25) * 60000).toISOString(), distanceM: int(15, 160), photo: true },
        checkOut: { time: new Date(t.getTime() + 7 * 3600000).toISOString() },
      });
    });
    settle(r, chosen);
  }

  // Today: in progress, check-ins arriving, some flagged.
  {
    const r = addReq({ dayOff: 0, status: 'in_progress', needed: 10, businessId: 'B-201', urgent: false, startH: Math.max(1, new Date().getHours() - 1) });
    const chosen = sample(pool, 12);
    const t = new Date(r.date);
    chosen.forEach((w, i) => {
      if (i < 6) addApp(r, w, 'checked_in', { checkIn: { time: new Date(t.getTime() - int(4, 24) * 60000).toISOString(), distanceM: int(12, 150), photo: true } });
      else if (i === 6) addApp(r, w, 'checked_in', { checkIn: { time: new Date(t.getTime() - 3 * 60000).toISOString(), distanceM: 860, photo: true, flag: 'distance' } });
      else if (i === 7) addApp(r, w, 'checked_in', { checkIn: { time: new Date(t.getTime() + 2 * 60000).toISOString(), distanceM: 95, photo: false, flag: 'photo' } });
      else if (i === 8) addApp(r, w, 'checked_in', { checkIn: { time: new Date(t.getTime() + 6 * 60000).toISOString(), distanceM: 2310, photo: true, flag: 'distance' } });
      else if (i === 9) addApp(r, w, 'approved');
      else addApp(r, w, 'waitlisted');
    });
  }

  // Upcoming: filled.
  for (const [d, needed] of [[1, 6], [2, 12]] as const) {
    const r = addReq({ dayOff: d, status: 'filled', needed });
    sample(pool, needed + 2).forEach((w, i) => addApp(r, w, i < needed ? 'approved' : 'waitlisted'));
  }

  // Upcoming: open, waiting on the ops team.
  for (const [d, needed, applied, approved, biz] of [
    [1, 10, 14, 4, 'B-201'],
    [2, 8, 9, 0, 'B-203'],
    [3, 15, 11, 6, 'B-204'],
    [4, 5, 7, 2, 'B-206'],
    [6, 20, 6, 0, 'B-208'],
  ] as const) {
    const r = addReq({ dayOff: d, status: 'open', needed, businessId: biz });
    sample(pool, applied).forEach((w, i) => addApp(r, w, i < approved ? 'approved' : 'applied'));
  }

  addReq({ dayOff: 5, status: 'awaiting_funding', needed: 6, businessId: 'B-207' });
  {
    const r = addReq({ dayOff: 2, status: 'cancelled', needed: 8, businessId: 'B-205' });
    r.cancelReason = 'Shoot postponed by the production house';
    const sp = split(r.pay, r.commissionRate, r.commissionMode);
    ledger.push({ id: `L-${++lid}`, type: 'refund', amount: sp.businessPays * r.workersNeeded, reqId: r.id, businessId: r.businessId, date: at(-1, 15), ref: `RFD${int(100000, 999999)}` });
  }

  const wd = (i: number, amount: number, dayOff: number, h: number, status: Withdrawal['status'], extra: Partial<Withdrawal> = {}): Withdrawal => ({
    id: `WD-${3001 + i}`,
    workerId: pool[i].id,
    amount,
    upi: pool[i].upi,
    requestedAt: at(dayOff, h, int(0, 59)),
    status,
    ...extra,
  });
  const withdrawals: Withdrawal[] = [
    wd(0, 2400, 0, 9, 'requested'),
    wd(1, 800, 0, 8, 'requested'),
    wd(2, 4250, -1, 19, 'requested'),
    wd(3, 1600, -1, 14, 'requested'),
    wd(5, 3200, -1, 11, 'requested'),
    wd(6, 1700, -2, 16, 'paid', { ref: 'UPI428813907' }),
    wd(7, 900, -3, 10, 'paid', { ref: 'UPI428700142' }),
    wd(9, 5600, -3, 9, 'paid', { ref: 'UPI428655310' }),
    wd(10, 750, -4, 13, 'rejected', { note: 'UPI ID did not match the KYC name' }),
  ];

  const audit: AuditEntry[] = [
    { id: 'AU-1', time: at(0, 8, 42), actor: 'Ops · Demo Admin', action: 'Marked withdrawal paid', target: 'WD-3006', detail: 'Ref UPI428813907' },
    { id: 'AU-2', time: at(-1, 18, 5), actor: 'Ops · Demo Admin', action: 'Approved applicant', target: `${pool[3].name} → ${requirements[requirements.length - 6].id}` },
    { id: 'AU-3', time: at(-1, 15, 0), actor: 'Ops · Demo Admin', action: 'Cancelled requirement', target: requirements[requirements.length - 1].id, detail: 'Shoot postponed by the production house' },
    { id: 'AU-4', time: at(-2, 11, 30), actor: 'Ops · Demo Admin', action: 'Approved business KYC', target: 'Periyar Logistics Hub' },
    { id: 'AU-5', time: at(-3, 10, 12), actor: 'Ops · Demo Admin', action: 'Suspended worker', target: workers[14].name, detail: 'Third strike in 30 days' },
  ];

  ledger.sort((a, b) => b.date.localeCompare(a.date));

  return {
    workers,
    businesses,
    requirements,
    applications,
    withdrawals,
    ledger,
    audit,
    settings: { commissionRate: 15, commissionMode: 'on_top', cancelWindowHours: 12, radiusKm: 15, geofenceM: 500, reminderHours: 2 },
  };
}
