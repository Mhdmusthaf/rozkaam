// Data shapes used by the UI. They mirror the tables in PLAN.md §4 so the
// in-memory demo store can later be swapped for the real API.

export type Role = 'worker' | 'business';
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';

export const CATEGORIES = ['Events', 'Catering', 'Hospitality', 'Film & Production', 'Retail', 'Promotions', 'Logistics', 'Call centre'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SKILLS = [
  'Banquet service',
  'Food service',
  'Kitchen helper',
  'Bartending',
  'Housekeeping',
  'Front desk',
  'Ushering',
  'Event setup',
  'Stage crew',
  'Crowd management',
  'Promotions',
  'Retail sales',
  'Cashier',
  'Packing',
  'Loading',
  'Delivery',
  'Tele-calling',
  'Data entry',
  'Film extra',
  'Production assistant',
] as const;

export const EXPERIENCE = ['New to this', 'Under 1 year', '1–3 years', '3+ years'] as const;

export const DISTRICTS = [
  'Ernakulam',
  'Thiruvananthapuram',
  'Kollam',
  'Pathanamthitta',
  'Alappuzha',
  'Kottayam',
  'Idukki',
  'Thrissur',
  'Palakkad',
  'Malappuram',
  'Kozhikode',
  'Wayanad',
  'Kannur',
  'Kasaragod',
] as const;

export const BUSINESS_TYPES = ['Event management', 'Catering', 'Hotel / Resort', 'Restaurant / Café', 'Production house', 'Retail', 'Call centre', 'Logistics', 'Other'] as const;

/** Requirement lifecycle. `completed` = work done, attendance awaiting approval. `paid` = closed. */
export type ReqStatus = 'awaiting_funding' | 'open' | 'filled' | 'in_progress' | 'completed' | 'paid' | 'cancelled';

export type RosterStatus = 'applied' | 'confirmed' | 'waitlisted' | 'checked_in' | 'checked_out' | 'no_show' | 'paid';

export interface RosterEntry {
  id: string;
  name: string;
  rating: number;
  jobsDone: number;
  reliability: number; // 0-100
  skills: string[];
  status: RosterStatus;
  checkIn?: string; // HH:mm
  checkOut?: string;
  late?: boolean;
  flag?: string; // e.g. "620 m from venue"
  rated?: number;
}

export interface Job {
  id: string;
  businessId: string; // 'me' = the signed-in business
  business: string;
  businessRating: number;
  businessJobs: number;
  title: string;
  category: Category;
  description: string;
  dateISO: string;
  report: string; // HH:mm reporting time
  start: string;
  end: string;
  pay: number; // ₹ per worker, what the worker receives
  needed: number;
  confirmed: number;
  applied: number;
  venue: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  distanceKm: number;
  dress: string;
  gender: 'Any' | 'Male' | 'Female';
  skills: string[];
  experience: string;
  instructions: string;
  pocName: string;
  pocPhone: string;
  urgent: boolean;
  status: ReqStatus;
  roster: RosterEntry[];
  commissionRate: number;
  commissionMode: 'on_top' | 'deducted';
  createdAt: string;
}

export type AppStatus = 'applied' | 'confirmed' | 'waitlisted' | 'rejected' | 'checked_in' | 'checked_out' | 'paid' | 'cancelled' | 'late_cancel' | 'no_show';

export interface Attendance {
  at: string; // ISO timestamp
  photo?: string | null;
  lat?: number;
  lng?: number;
  distanceM?: number;
  flagged?: boolean;
}

export interface Application {
  id: string;
  jobId: string;
  status: AppStatus;
  appliedAt: string;
  checkIn?: Attendance;
  checkOut?: Attendance;
  ratedBusiness?: number;
}

export interface WalletTxn {
  id: string;
  kind: 'earning' | 'withdrawal';
  title: string;
  sub: string;
  amount: number; // positive
  at: string;
  status: 'completed' | 'processing' | 'rejected';
}

export interface BizTxn {
  id: string;
  kind: 'funding' | 'refund';
  title: string;
  sub: string;
  amount: number;
  at: string;
  jobId?: string;
  invoice: string;
}

export interface Notice {
  id: string;
  role: Role;
  icon: string;
  tone: 'violet' | 'success' | 'warn' | 'danger' | 'info';
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
}

export interface Strike {
  id: string;
  reason: 'Late cancellation' | 'No-show';
  job: string;
  at: string;
  excused: boolean;
}

export interface WorkerProfile {
  name: string;
  photo: string | null;
  dob: string;
  gender: string;
  district: string;
  area: string;
  skills: string[];
  experience: string;
  about: string;
  idType: string;
  idNumber: string;
  idPhoto: string | null;
  selfie: string | null;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upi: string;
  rating: number;
  ratingCount: number;
  jobsDone: number;
  hours: number;
  reliability: number;
  strikes: Strike[];
}

export interface Company {
  name: string;
  type: string;
  gstin: string;
  address: string;
  district: string;
  contactName: string;
  contactRole: string;
  email: string;
  docRegistration: string | null;
  docId: string | null;
  rating: number;
  ratingCount: number;
}

export interface Session {
  signedIn: boolean;
  role: Role | null;
  phone: string;
  workerOnboarded: boolean;
  businessOnboarded: boolean;
  workerKyc: KycStatus;
  businessKyc: KycStatus;
}

/** A new requirement as typed into the form. */
export type ReqDraft = Pick<
  Job,
  | 'title'
  | 'category'
  | 'description'
  | 'dateISO'
  | 'report'
  | 'start'
  | 'end'
  | 'pay'
  | 'needed'
  | 'venue'
  | 'address'
  | 'area'
  | 'dress'
  | 'gender'
  | 'skills'
  | 'experience'
  | 'instructions'
  | 'pocName'
  | 'pocPhone'
  | 'urgent'
>;
