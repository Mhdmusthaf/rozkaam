// Worker and business profiles, and submitting them for verification (KYC).
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { schema, type Db, type Tx } from '../db/client';
import { bad, conflict, notFound } from '../lib/errors';
import { reliabilityScore } from '../rules/reliability';
import { activeStrikeCount } from './core';

const { workerProfiles, businesses, users } = schema;

// ---------------------------------------------------------------- worker
export const workerPatch = z
  .object({
    name: z.string().trim().min(3).max(80),
    photoKey: z.string().nullable(),
    dob: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Use DD/MM/YYYY'),
    gender: z.enum(['Male', 'Female', 'Other']),
    district: z.string().min(2).max(40),
    area: z.string().trim().min(2).max(60),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    skills: z.array(z.string().max(40)).max(20),
    experience: z.string().max(30),
    about: z.string().max(200),
    idType: z.string().max(30),
    idNumber: z.string().max(30),
    idPhotoKey: z.string().nullable(),
    selfieKey: z.string().nullable(),
    bankName: z.string().max(80),
    accountNumber: z.string().regex(/^\d{9,18}$/, 'Enter a valid account number'),
    ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC'),
    upi: z.string().max(60),
  })
  .partial();

// Once verified, identity and bank details can only change through support.
const LOCKED_AFTER_KYC = ['idType', 'idNumber', 'idPhotoKey', 'selfieKey', 'bankName', 'accountNumber', 'ifsc', 'dob'] as const;

const adultOn = (dob: string) => {
  const [d, m, y] = dob.split('/').map(Number) as [number, number, number];
  const eighteenth = new Date(y + 18, m - 1, d);
  return eighteenth <= new Date();
};

export async function getWorker(db: Tx, userId: string) {
  const [p] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, userId));
  if (!p) throw notFound('Worker profile');
  const [u] = await db.select({ status: users.status, phone: users.phone }).from(users).where(eq(users.id, userId));
  const strikes = await activeStrikeCount(db, userId);
  return {
    ...p,
    phone: u!.phone,
    accountStatus: u!.status,
    rating: p.ratingCount ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : 0,
    activeStrikes: strikes,
    reliability: reliabilityScore(strikes),
  };
}

export async function updateWorker(db: Db, userId: string, patch: z.infer<typeof workerPatch>) {
  const current = await getWorker(db, userId);
  if (current.kycStatus === 'verified' || current.kycStatus === 'pending') {
    for (const k of LOCKED_AFTER_KYC) {
      if (k in patch && patch[k] !== current[k]) throw conflict('kyc_locked', 'Identity and bank details cannot be changed after submission. Message support to update them.');
    }
  }
  if (patch.dob && !adultOn(patch.dob)) throw bad('under_age', 'You must be 18 or older to work through Rozkaam.');
  if (Object.keys(patch).length) await db.update(workerProfiles).set(patch).where(eq(workerProfiles.userId, userId));
  return getWorker(db, userId);
}

export async function submitWorkerKyc(db: Db, userId: string) {
  const p = await getWorker(db, userId);
  if (p.kycStatus === 'verified') throw conflict('already_verified', 'Your account is already verified.');
  const missing = [
    !p.name && 'name',
    !p.dob && 'date of birth',
    !p.district && 'district',
    !p.area && 'area',
    p.skills.length === 0 && 'skills',
    !p.idType && 'ID type',
    !p.idNumber && 'ID number',
    !p.idPhotoKey && 'ID photo',
    !p.selfieKey && 'selfie',
    !p.accountNumber && 'bank account',
    !p.ifsc && 'IFSC',
  ].filter(Boolean);
  if (missing.length) throw bad('profile_incomplete', `Add these before submitting: ${missing.join(', ')}.`);
  await db.update(workerProfiles).set({ kycStatus: 'pending', kycNote: null }).where(eq(workerProfiles.userId, userId));
  return getWorker(db, userId);
}

// ---------------------------------------------------------------- business
export const businessPatch = z
  .object({
    name: z.string().trim().min(3).max(100),
    type: z.string().max(40),
    gstin: z.union([z.literal(''), z.string().regex(/^[0-9A-Z]{15}$/, 'A GSTIN has 15 letters and digits')]),
    address: z.string().trim().min(8).max(200),
    district: z.string().min(2).max(40),
    contactName: z.string().trim().min(3).max(80),
    contactRole: z.string().max(60),
    email: z.string().email(),
    docRegistrationKey: z.string().nullable(),
    docIdKey: z.string().nullable(),
  })
  .partial();

export async function getBusinessByOwner(db: Tx, ownerUserId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId));
  if (!b) throw notFound('Business');
  return { ...b, rating: b.ratingCount ? Math.round((b.ratingSum / b.ratingCount) * 10) / 10 : 0 };
}

export async function updateBusiness(db: Db, ownerUserId: string, patch: z.infer<typeof businessPatch>) {
  const b = await getBusinessByOwner(db, ownerUserId);
  if (b.kycStatus !== 'none' && b.kycStatus !== 'rejected') {
    for (const k of ['name', 'gstin', 'docRegistrationKey', 'docIdKey'] as const) {
      if (k in patch && patch[k] !== b[k]) throw conflict('kyc_locked', 'Registered name and documents cannot be changed after submission. Message support to update them.');
    }
  }
  if (Object.keys(patch).length) await db.update(businesses).set(patch).where(eq(businesses.id, b.id));
  return getBusinessByOwner(db, ownerUserId);
}

export async function submitBusinessKyc(db: Db, ownerUserId: string) {
  const b = await getBusinessByOwner(db, ownerUserId);
  if (b.kycStatus === 'verified') throw conflict('already_verified', 'Your business is already verified.');
  const missing = [!b.name && 'business name', !b.type && 'business type', !b.address && 'address', !b.contactName && 'contact person', !b.email && 'email', !b.docRegistrationKey && 'registration document', !b.docIdKey && 'signatory ID'].filter(Boolean);
  if (missing.length) throw bad('profile_incomplete', `Add these before submitting: ${missing.join(', ')}.`);
  await db.update(businesses).set({ kycStatus: 'pending', kycNote: null }).where(eq(businesses.id, b.id));
  return getBusinessByOwner(db, ownerUserId);
}
