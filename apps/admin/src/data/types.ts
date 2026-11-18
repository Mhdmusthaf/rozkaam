export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned';
/** 'none' = signed up but has not submitted documents yet (live data only). */
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface Strike {
  id: string;
  date: string;
  reason: 'Late cancellation' | 'No-show' | 'Misconduct';
  requirement: string;
  excused: boolean;
  note?: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  area: string;
  district: string;
  gender: 'Male' | 'Female';
  age: number;
  skills: string[];
  experience: string;
  rating: number;
  ratingCount: number;
  jobsDone: number;
  reliability: number;
  strikes: Strike[];
  status: AccountStatus;
  kyc: KycStatus;
  kycDocType: string;
  kycDocLast4: string;
  kycSubmitted: string;
  kycRejectReason?: string;
  upi: string;
  joined: string;
  /** Live data only: keys of the private KYC files on the server. */
  idPhotoKey?: string;
  selfieKey?: string;
}

export interface Business {
  id: string;
  name: string;
  category: string;
  gstin: string;
  address: string;
  area: string;
  contactName: string;
  contactPhone: string;
  email: string;
  rating: number;
  ratingCount: number;
  status: AccountStatus;
  kyc: KycStatus;
  kycSubmitted: string;
  kycRejectReason?: string;
  docs: string[];
  /** Live data only: document label -> key of the private file on the server. */
  docKeys?: Record<string, string | undefined>;
  joined: string;
}

export type ReqStatus = 'awaiting_funding' | 'open' | 'filled' | 'in_progress' | 'completed' | 'cancelled';
export type CommissionMode = 'on_top' | 'deducted';

export interface Requirement {
  id: string;
  businessId: string;
  title: string;
  category: string;
  description: string;
  workersNeeded: number;
  venue: string;
  address: string;
  date: string; // ISO date
  reportTime: string;
  startTime: string;
  endTime: string;
  pay: number; // advertised pay per worker, rupees
  dressCode: string;
  gender: string;
  attributes: string;
  skills: string[];
  instructions: string;
  pocName: string;
  pocPhone: string;
  urgent: boolean;
  status: ReqStatus;
  commissionRate: number;
  commissionMode: CommissionMode;
  funded: boolean;
  createdAt: string;
  cancelReason?: string;
}

export type AppStatus =
  | 'applied'
  | 'approved'
  | 'waitlisted'
  | 'rejected'
  | 'checked_in'
  | 'checked_out'
  | 'paid'
  | 'withdrawn'
  | 'late_cancel'
  | 'no_show';

export interface Application {
  id: string;
  reqId: string;
  workerId: string;
  status: AppStatus;
  appliedAt: string;
  /** Kilometres from the venue. -1 = not known (the server does not report it yet). */
  distanceKm: number;
  /** distanceM -1 = no location was captured. photoKey and reason come from live data only. */
  checkIn?: { time: string; distanceM: number; photo: boolean; photoKey?: string; flag?: 'distance' | 'photo'; reason?: string; resolved?: 'accepted' | 'no_show' };
  checkOut?: { time: string };
}

export interface Withdrawal {
  id: string;
  workerId: string;
  amount: number;
  upi: string;
  requestedAt: string;
  status: 'requested' | 'paid' | 'rejected';
  ref?: string;
  note?: string;
}

export type LedgerType = 'funding' | 'payout' | 'commission' | 'refund';

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  amount: number;
  /** For payouts: the gross work value this payout represents (counts towards GMV). */
  gross?: number;
  reqId: string;
  businessId?: string;
  workerId?: string;
  date: string;
  ref: string;
}

export interface AuditEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
}

export interface Settings {
  commissionRate: number;
  commissionMode: CommissionMode;
  cancelWindowHours: number;
  radiusKm: number;
  geofenceM: number;
  reminderHours: number;
}

export interface Db {
  workers: Worker[];
  businesses: Business[];
  requirements: Requirement[];
  applications: Application[];
  withdrawals: Withdrawal[];
  ledger: LedgerEntry[];
  audit: AuditEntry[];
  settings: Settings;
}
