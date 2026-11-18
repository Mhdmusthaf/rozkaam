// Sign-in with a phone number and a one-time code.
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { createHash, timingSafeEqual } from 'node:crypto';

import { schema, type Db } from '../db/client';
import { env } from '../env';
import { now } from '../lib/clock';
import { AppError, bad, conflict, forbidden, unauthorized } from '../lib/errors';
import { sendOtp } from '../providers/sms';

const { users, otpCodes, sessions, workerProfiles, businesses } = schema;

const secret = new TextEncoder().encode(env.JWT_SECRET);
const OTP_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const SESSION_DAYS = 30;

export type Role = 'worker' | 'business' | 'admin';
export interface AuthUser {
  id: string;
  phone: string;
  role: Role;
  status: 'active' | 'restricted' | 'suspended' | 'banned';
  sessionId: string;
}

export const normalisePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw bad('invalid_phone', 'Enter a valid 10-digit mobile number.');
  return digits;
};

const hash = (phone: string, code: string) => createHash('sha256').update(`${phone}:${code}:${env.JWT_SECRET}`).digest('hex');

/** Creates a code, stores only its hash, and sends it through the SMS provider. */
export async function requestOtp(db: Db, rawPhone: string) {
  const phone = normalisePhone(rawPhone);
  const code = await sendOtp(phone);
  const expiresAt = new Date(now().getTime() + OTP_MINUTES * 60_000);
  await db
    .insert(otpCodes)
    .values({ phone, codeHash: hash(phone, code), expiresAt, attempts: 0 })
    .onConflictDoUpdate({ target: otpCodes.phone, set: { codeHash: hash(phone, code), expiresAt, attempts: 0 } });
  return { phone, expiresInSeconds: OTP_MINUTES * 60, sandbox: env.SMS_PROVIDER === 'sandbox' };
}

/** Checks the code, creates the account on first sign-in, and returns a session token. */
export async function verifyOtp(db: Db, rawPhone: string, code: string, role: Role) {
  const phone = normalisePhone(rawPhone);
  const [otp] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
  if (!otp || otp.expiresAt < now()) throw bad('otp_expired', 'That code has expired. Request a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) throw new AppError(429, 'otp_locked', 'Too many wrong attempts. Request a new code.');

  const a = Buffer.from(otp.codeHash);
  const b = Buffer.from(hash(phone, code));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.phone, phone));
    throw bad('otp_wrong', 'That code is not correct.');
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));

  let [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (user && user.role !== role) {
    throw conflict('role_mismatch', `This number is registered as ${user.role === 'admin' ? 'an admin' : `a ${user.role}`}. Sign in that way instead.`);
  }
  if (!user) {
    if (role === 'admin' && !env.adminPhones.includes(phone)) throw forbidden('This number is not an admin account.');
    [user] = await db.insert(users).values({ phone, role }).returning();
    if (role === 'worker') await db.insert(workerProfiles).values({ userId: user!.id });
    if (role === 'business') await db.insert(businesses).values({ ownerUserId: user!.id });
  }
  if (user!.status === 'banned') throw forbidden('This account has been closed. Contact Rozkaam support.');

  const expiresAt = new Date(now().getTime() + SESSION_DAYS * 86_400_000);
  const [session] = await db.insert(sessions).values({ userId: user!.id, expiresAt }).returning();
  const token = await new SignJWT({ sid: session!.id, role: user!.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user!.id)
    .setIssuedAt(Math.floor(now().getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);
  return { token, user: { id: user!.id, phone: user!.phone, role: user!.role, status: user!.status } };
}

/** Resolves a bearer token to a signed-in user, or throws 401. */
export async function authenticate(db: Db, token: string | undefined): Promise<AuthUser> {
  if (!token) throw unauthorized();
  let sub: string | undefined;
  let sid: string | undefined;
  try {
    const { payload } = await jwtVerify(token, secret, { currentDate: now() });
    sub = payload.sub;
    sid = payload.sid as string | undefined;
  } catch {
    throw unauthorized();
  }
  if (!sub || !sid) throw unauthorized();
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sid));
  if (!session || session.revokedAt || session.expiresAt < now() || session.userId !== sub) throw unauthorized();
  const [user] = await db.select().from(users).where(eq(users.id, sub));
  if (!user) throw unauthorized();
  if (user.status === 'banned') throw forbidden('This account has been closed. Contact Rozkaam support.');
  return { id: user.id, phone: user.phone, role: user.role, status: user.status, sessionId: sid };
}

export async function signOut(db: Db, sessionId: string) {
  await db.update(sessions).set({ revokedAt: now() }).where(eq(sessions.id, sessionId));
}
