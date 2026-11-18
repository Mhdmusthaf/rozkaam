// Rozkaam database tables. One system of record for the worker app, the
// business app and the admin panel. Money is stored in paise (whole numbers).
import { sql } from 'drizzle-orm';
import { boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const roleEnum = pgEnum('role', ['worker', 'business', 'admin']);
export const accountStatusEnum = pgEnum('account_status', ['active', 'restricted', 'suspended', 'banned']);
export const kycStatusEnum = pgEnum('kyc_status', ['none', 'pending', 'verified', 'rejected']);
export const jobStatusEnum = pgEnum('job_status', ['awaiting_funding', 'open', 'filled', 'in_progress', 'completed', 'paid', 'cancelled']);
export const commissionModeEnum = pgEnum('commission_mode', ['on_top', 'deducted']);
export const applicationStatusEnum = pgEnum('application_status', [
  'applied',
  'confirmed',
  'waitlisted',
  'rejected',
  'checked_in',
  'checked_out',
  'paid',
  'cancelled',
  'late_cancel',
  'no_show',
]);
export const attendanceKindEnum = pgEnum('attendance_kind', ['in', 'out']);
export const flagStateEnum = pgEnum('flag_state', ['none', 'open', 'accepted', 'no_show']);
export const ledgerTypeEnum = pgEnum('ledger_type', ['funding', 'payout', 'commission', 'refund', 'withdrawal']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['requested', 'paid', 'rejected']);
export const ratingDirectionEnum = pgEnum('rating_direction', ['worker_to_business', 'business_to_worker']);
export const strikeReasonEnum = pgEnum('strike_reason', ['late_cancel', 'no_show', 'misconduct']);

export const users = pgTable('users', {
  id: id(),
  phone: text('phone').notNull().unique(),
  role: roleEnum('role').notNull(),
  status: accountStatusEnum('status').notNull().default('active'),
  createdAt: createdAt(),
});

export const otpCodes = pgTable('otp_codes', {
  phone: text('phone').primaryKey(),
  codeHash: text('code_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
});

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
  createdAt: createdAt(),
});

export const workerProfiles = pgTable('worker_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  name: text('name').notNull().default(''),
  photoKey: text('photo_key'),
  dob: text('dob').notNull().default(''),
  gender: text('gender').notNull().default(''),
  district: text('district').notNull().default(''),
  area: text('area').notNull().default(''),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  skills: text('skills').array().notNull().default(sql`'{}'::text[]`),
  experience: text('experience').notNull().default(''),
  about: text('about').notNull().default(''),
  idType: text('id_type').notNull().default(''),
  idNumber: text('id_number').notNull().default(''),
  idPhotoKey: text('id_photo_key'),
  selfieKey: text('selfie_key'),
  bankName: text('bank_name').notNull().default(''),
  accountNumber: text('account_number').notNull().default(''),
  ifsc: text('ifsc').notNull().default(''),
  upi: text('upi').notNull().default(''),
  kycStatus: kycStatusEnum('kyc_status').notNull().default('none'),
  kycNote: text('kyc_note'),
  ratingSum: integer('rating_sum').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  jobsDone: integer('jobs_done').notNull().default(0),
  minutesWorked: integer('minutes_worked').notNull().default(0),
  createdAt: createdAt(),
});

export const businesses = pgTable('businesses', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().unique().references(() => users.id),
  name: text('name').notNull().default(''),
  type: text('type').notNull().default(''),
  gstin: text('gstin').notNull().default(''),
  address: text('address').notNull().default(''),
  district: text('district').notNull().default(''),
  contactName: text('contact_name').notNull().default(''),
  contactRole: text('contact_role').notNull().default(''),
  email: text('email').notNull().default(''),
  docRegistrationKey: text('doc_registration_key'),
  docIdKey: text('doc_id_key'),
  kycStatus: kycStatusEnum('kyc_status').notNull().default('none'),
  kycNote: text('kyc_note'),
  ratingSum: integer('rating_sum').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  createdAt: createdAt(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: id(),
    businessId: uuid('business_id').notNull().references(() => businesses.id),
    title: text('title').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull().default(''),
    workDate: date('work_date').notNull(),
    reportTime: text('report_time').notNull(), // HH:mm, India time
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    startsAt: ts('starts_at').notNull(), // exact start, used by the cancellation rule
    payPaise: integer('pay_paise').notNull(), // advertised pay per worker
    needed: integer('needed').notNull(),
    venue: text('venue').notNull(),
    address: text('address').notNull().default(''),
    area: text('area').notNull().default(''),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    dress: text('dress').notNull().default(''),
    gender: text('gender').notNull().default('Any'),
    skills: text('skills').array().notNull().default(sql`'{}'::text[]`),
    experience: text('experience').notNull().default(''),
    instructions: text('instructions').notNull().default(''),
    pocName: text('poc_name').notNull().default(''),
    pocPhone: text('poc_phone').notNull().default(''),
    urgent: boolean('urgent').notNull().default(false),
    status: jobStatusEnum('status').notNull().default('awaiting_funding'),
    // The commission terms a job was posted under never change afterwards.
    commissionBps: integer('commission_bps').notNull(), // 1500 = 15%
    commissionMode: commissionModeEnum('commission_mode').notNull(),
    fundedAt: ts('funded_at'),
    closedAt: ts('closed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('jobs_status_idx').on(t.status), index('jobs_business_idx').on(t.businessId)],
);

export const applications = pgTable(
  'applications',
  {
    id: id(),
    jobId: uuid('job_id').notNull().references(() => jobs.id),
    workerId: uuid('worker_id').notNull().references(() => users.id),
    status: applicationStatusEnum('status').notNull().default('applied'),
    appliedAt: ts('applied_at').notNull().defaultNow(),
    decidedAt: ts('decided_at'),
    decidedBy: uuid('decided_by').references(() => users.id),
  },
  (t) => [unique('applications_job_worker').on(t.jobId, t.workerId), index('applications_worker_idx').on(t.workerId)],
);

export const attendance = pgTable(
  'attendance',
  {
    id: id(),
    applicationId: uuid('application_id').notNull().references(() => applications.id),
    kind: attendanceKindEnum('kind').notNull(),
    at: ts('at').notNull(), // always the server's clock
    photoKey: text('photo_key'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    distanceM: integer('distance_m'),
    flag: flagStateEnum('flag').notNull().default('none'),
    flagReason: text('flag_reason'),
    late: boolean('late').notNull().default(false),
  },
  (t) => [unique('attendance_app_kind').on(t.applicationId, t.kind)],
);

export const ledger = pgTable(
  'ledger',
  {
    id: id(),
    type: ledgerTypeEnum('type').notNull(),
    amountPaise: integer('amount_paise').notNull(), // always positive
    jobId: uuid('job_id').references(() => jobs.id),
    applicationId: uuid('application_id').references(() => applications.id),
    businessId: uuid('business_id').references(() => businesses.id),
    workerId: uuid('worker_id').references(() => users.id),
    ref: text('ref'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('ledger_worker_idx').on(t.workerId), index('ledger_business_idx').on(t.businessId)],
);

export const withdrawals = pgTable('withdrawals', {
  id: id(),
  workerId: uuid('worker_id').notNull().references(() => users.id),
  amountPaise: integer('amount_paise').notNull(),
  destination: text('destination').notNull(),
  status: withdrawalStatusEnum('status').notNull().default('requested'),
  reference: text('reference'),
  note: text('note'),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: ts('decided_at'),
  createdAt: createdAt(),
});

export const ratings = pgTable(
  'ratings',
  {
    id: id(),
    applicationId: uuid('application_id').notNull().references(() => applications.id),
    direction: ratingDirectionEnum('direction').notNull(),
    stars: integer('stars').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    comment: text('comment').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [unique('ratings_app_direction').on(t.applicationId, t.direction)],
);

export const strikes = pgTable('strikes', {
  id: id(),
  workerId: uuid('worker_id').notNull().references(() => users.id),
  reason: strikeReasonEnum('reason').notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  excused: boolean('excused').notNull().default(false),
  note: text('note'),
  createdAt: createdAt(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    icon: text('icon').notNull().default('notifications'),
    tone: text('tone').notNull().default('violet'),
    href: text('href'),
    read: boolean('read').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId)],
);

export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: createdAt(),
});

export const files = pgTable('files', {
  key: text('key').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  contentType: text('content_type').notNull(),
  createdAt: createdAt(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

export const auditLog = pgTable('audit_log', {
  id: id(),
  adminId: uuid('admin_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  target: text('target').notNull(),
  detail: jsonb('detail'),
  createdAt: createdAt(),
});
