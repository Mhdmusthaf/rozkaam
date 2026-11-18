// HTTP routes. Routes stay thin: they check who is calling, validate the
// input, and hand over to a service. Business rules live in src/services
// and src/rules, never here.
import { and, desc, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { z, ZodError } from 'zod';

import { schema, type Db } from './db/client';
import { now } from './lib/clock';
import { AppError, bad, forbidden, notFound } from './lib/errors';
import { isAllowedType, MAX_UPLOAD_BYTES, readStoredFile, saveFile } from './providers/storage';
import * as accounts from './services/accounts';
import * as admin from './services/admin';
import { authenticate, requestOtp, signOut, verifyOtp, type AuthUser, type Role } from './services/auth';
import { getSettings, updateSettings } from './services/core';
import * as jobs from './services/jobs';
import * as money from './services/money';

type Env = { Variables: { user: AuthUser } };
type C = Context<Env>;

const body = async <T extends z.ZodType>(c: C, shape: T): Promise<z.infer<T>> => shape.parse(await c.req.json().catch(() => ({})));
const uuid = (c: C, name = 'id') => z.string().uuid().parse(c.req.param(name));

export function createApp(db: Db) {
  const app = new Hono<Env>();
  app.use('*', cors());

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return c.json({ error: { code: 'invalid_input', message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.', issues: err.issues } }, 422);
    }
    console.error(err);
    return c.json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } }, 500);
  });

  app.get('/health', (c) => c.json({ ok: true, time: now().toISOString() }));

  // ------------------------------------------------------------ sign-in
  const roleShape = z.enum(['worker', 'business', 'admin']);
  app.post('/v1/auth/otp/request', async (c) => c.json(await requestOtp(db, (await body(c, z.object({ phone: z.string() }))).phone)));
  app.post('/v1/auth/otp/verify', async (c) => {
    const b = await body(c, z.object({ phone: z.string(), code: z.string().regex(/^\d{6}$/), role: roleShape }));
    return c.json(await verifyOtp(db, b.phone, b.code, b.role));
  });

  // Everything below needs a signed-in user.
  const auth = (...roles: Role[]) =>
    async (c: C, next: () => Promise<void>) => {
      const header = c.req.header('authorization') ?? '';
      const user = await authenticate(db, header.startsWith('Bearer ') ? header.slice(7) : undefined);
      if (roles.length && !roles.includes(user.role)) throw forbidden();
      c.set('user', user);
      await next();
    };
  const me = (c: C) => c.get('user');

  app.use('/v1/me', auth());
  app.use('/v1/auth/sign-out', auth());
  app.use('/v1/notifications/*', auth());
  app.use('/v1/notifications', auth());
  app.use('/v1/uploads', auth());
  app.use('/v1/files/*', auth());
  app.use('/v1/settings/public', auth());
  app.use('/v1/worker/*', auth('worker'));
  app.use('/v1/business/*', auth('business'));
  app.use('/v1/admin/*', auth('admin'));

  app.get('/v1/me', (c) => c.json(me(c)));
  app.post('/v1/auth/sign-out', async (c) => {
    await signOut(db, me(c).sessionId);
    return c.json({ ok: true });
  });

  // The few settings the apps need to explain the rules to people.
  app.get('/v1/settings/public', async (c) => {
    const s = await getSettings(db);
    return c.json({ cancelWindowHours: s.cancelWindowHours, geofenceM: s.geofenceM, radiusKm: s.radiusKm, minWithdrawalPaise: s.minWithdrawalPaise, commissionBps: s.commissionBps, commissionMode: s.commissionMode });
  });

  // ------------------------------------------------------------ notifications
  app.get('/v1/notifications', async (c) => c.json(await db.select().from(schema.notifications).where(eq(schema.notifications.userId, me(c).id)).orderBy(desc(schema.notifications.createdAt)).limit(100)));
  app.post('/v1/notifications/read', async (c) => {
    const b = await body(c, z.object({ id: z.string().uuid().optional() }));
    await db
      .update(schema.notifications)
      .set({ read: true })
      .where(b.id ? and(eq(schema.notifications.userId, me(c).id), eq(schema.notifications.id, b.id)) : eq(schema.notifications.userId, me(c).id));
    return c.json({ ok: true });
  });

  // ------------------------------------------------------------ files
  app.post('/v1/uploads', async (c) => {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) throw bad('no_file', 'Attach a file.');
    if (!isAllowedType(file.type)) throw bad('bad_type', 'Upload a JPG, PNG, WebP or PDF file.');
    if (file.size > MAX_UPLOAD_BYTES) throw bad('too_large', 'The file is larger than 8 MB.');
    const key = await saveFile(new Uint8Array(await file.arrayBuffer()), file.type);
    await db.insert(schema.files).values({ key, ownerId: me(c).id, contentType: file.type });
    return c.json({ key });
  });
  // Private files: the owner and admins can read them. A business can read the
  // check-in photos for its own requirements.
  app.get('/v1/files/:key', async (c) => {
    const key = c.req.param('key');
    const [f] = await db.select().from(schema.files).where(eq(schema.files.key, key));
    if (!f) throw notFound('File');
    const u = me(c);
    let allowed = u.role === 'admin' || f.ownerId === u.id;
    if (!allowed && u.role === 'business') {
      const [hit] = await db
        .select({ id: schema.attendance.id })
        .from(schema.attendance)
        .innerJoin(schema.applications, eq(schema.applications.id, schema.attendance.applicationId))
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
        .innerJoin(schema.businesses, eq(schema.businesses.id, schema.jobs.businessId))
        .where(and(eq(schema.attendance.photoKey, key), eq(schema.businesses.ownerUserId, u.id)));
      allowed = !!hit;
    }
    if (!allowed) throw notFound('File');
    const bytes = await readStoredFile(key);
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(copy, { headers: { 'content-type': f.contentType, 'cache-control': 'private, max-age=300' } });
  });

  // ------------------------------------------------------------ worker
  app.get('/v1/worker/profile', async (c) => c.json(await accounts.getWorker(db, me(c).id)));
  app.put('/v1/worker/profile', async (c) => c.json(await accounts.updateWorker(db, me(c).id, await body(c, accounts.workerPatch))));
  app.post('/v1/worker/kyc/submit', async (c) => c.json(await accounts.submitWorkerKyc(db, me(c).id)));
  app.get('/v1/worker/jobs', async (c) => c.json(await jobs.jobFeed(db, me(c).id, jobs.feedQuery.parse(c.req.query()))));
  app.get('/v1/worker/jobs/:id', async (c) => c.json(await jobs.getJobForWorker(db, me(c).id, uuid(c))));
  app.post('/v1/worker/jobs/:id/apply', async (c) => c.json(await jobs.apply(db, me(c).id, uuid(c)), 201));
  app.get('/v1/worker/applications', async (c) => c.json(await jobs.listWorkerApplications(db, me(c).id)));
  app.get('/v1/worker/applications/:id', async (c) => c.json(await jobs.getWorkerApplication(db, me(c).id, uuid(c))));
  app.post('/v1/worker/applications/:id/cancel', async (c) => c.json(await jobs.cancelApplication(db, me(c).id, uuid(c))));
  app.post('/v1/worker/applications/:id/check-in', async (c) => c.json(await jobs.recordAttendance(db, me(c).id, uuid(c), 'in', await body(c, jobs.attendanceInput)), 201));
  app.post('/v1/worker/applications/:id/check-out', async (c) => c.json(await jobs.recordAttendance(db, me(c).id, uuid(c), 'out', await body(c, jobs.attendanceInput)), 201));
  app.post('/v1/worker/applications/:id/rate', async (c) => {
    await jobs.rateBusiness(db, me(c).id, uuid(c), await body(c, jobs.ratingInput));
    return c.json({ ok: true });
  });
  app.get('/v1/worker/wallet', async (c) => c.json({ ...(await money.walletSummary(db, me(c).id)), history: await money.walletHistory(db, me(c).id) }));
  app.post('/v1/worker/withdrawals', async (c) => {
    const b = await body(c, z.object({ amountPaise: z.number().int().positive(), to: z.enum(['upi', 'bank']) }));
    return c.json(await money.requestWithdrawal(db, me(c).id, b.amountPaise, b.to), 201);
  });
  app.get('/v1/worker/strikes', async (c) => c.json(await admin.listStrikes(db, me(c).id)));

  // ------------------------------------------------------------ business
  app.get('/v1/business/profile', async (c) => c.json(await accounts.getBusinessByOwner(db, me(c).id)));
  app.put('/v1/business/profile', async (c) => c.json(await accounts.updateBusiness(db, me(c).id, await body(c, accounts.businessPatch))));
  app.post('/v1/business/kyc/submit', async (c) => c.json(await accounts.submitBusinessKyc(db, me(c).id)));
  app.get('/v1/business/jobs', async (c) => c.json(await jobs.listBusinessJobs(db, me(c).id)));
  app.post('/v1/business/jobs', async (c) => c.json(await jobs.createJob(db, me(c).id, await body(c, jobs.jobInput)), 201));
  app.get('/v1/business/jobs/:id', async (c) => c.json(await jobs.getBusinessJob(db, me(c).id, uuid(c))));
  app.post('/v1/business/jobs/:id/fund', async (c) => c.json(await jobs.fundJob(db, me(c).id, uuid(c))));
  app.post('/v1/business/jobs/:id/cancel', async (c) => c.json(await jobs.cancelJob(db, me(c).id, uuid(c))));
  app.post('/v1/business/jobs/:id/approve-attendance', async (c) => c.json(await jobs.approveAttendance(db, me(c).id, uuid(c))));
  app.post('/v1/business/applications/:id/no-show', async (c) => {
    await jobs.markNoShow(db, { ownerUserId: me(c).id }, uuid(c));
    return c.json({ ok: true });
  });
  app.post('/v1/business/applications/:id/rate', async (c) => {
    await jobs.rateWorker(db, me(c).id, uuid(c), await body(c, jobs.ratingInput));
    return c.json({ ok: true });
  });
  app.get('/v1/business/payments', async (c) => c.json(await money.businessPayments(db, me(c).id)));

  // ------------------------------------------------------------ admin
  const kind = (c: C) => z.enum(['worker', 'business']).parse(c.req.param('kind'));
  app.get('/v1/admin/dashboard', async (c) => c.json(await admin.dashboard(db)));
  app.get('/v1/admin/kyc/:kind', async (c) => c.json(await admin.kycQueue(db, kind(c), z.enum(['pending', 'rejected', 'verified']).default('pending').parse(c.req.query('status')))));
  app.post('/v1/admin/kyc/:kind/:id', async (c) => {
    const b = await body(c, z.object({ approve: z.boolean(), note: z.string().max(300).optional() }));
    return c.json(await admin.decideKyc(db, me(c).id, kind(c), uuid(c), b.approve, b.note));
  });
  app.get('/v1/admin/jobs', async (c) => c.json(await admin.listJobs(db, c.req.query('status'))));
  app.get('/v1/admin/jobs/:id', async (c) => c.json(await admin.getJob(db, uuid(c))));
  app.post('/v1/admin/applications/:id/decide', async (c) => {
    const b = await body(c, z.object({ decision: z.enum(['approve', 'waitlist', 'reject']) }));
    return c.json(await jobs.decideApplication(db, me(c).id, uuid(c), b.decision));
  });
  app.post('/v1/admin/applications/:id/no-show', async (c) => {
    await jobs.markNoShow(db, { adminId: me(c).id }, uuid(c));
    return c.json({ ok: true });
  });
  app.get('/v1/admin/flags', async (c) => c.json(await admin.listFlags(db, z.enum(['open', 'accepted', 'no_show']).default('open').parse(c.req.query('state')))));
  app.post('/v1/admin/flags/:id', async (c) => c.json(await admin.resolveFlag(db, me(c).id, uuid(c), (await body(c, z.object({ accept: z.boolean() }))).accept)));
  app.get('/v1/admin/users/:kind', async (c) => c.json(await admin.listUsers(db, kind(c))));
  app.post('/v1/admin/users/:id/status', async (c) => {
    const b = await body(c, z.object({ status: z.enum(['active', 'restricted', 'suspended', 'banned']), note: z.string().max(300) }));
    return c.json(await admin.setAccountStatus(db, me(c).id, uuid(c), b.status, b.note));
  });
  app.get('/v1/admin/workers/:id/strikes', async (c) => c.json(await admin.listStrikes(db, uuid(c))));
  app.post('/v1/admin/strikes/:id/excuse', async (c) => c.json(await admin.excuseStrike(db, me(c).id, uuid(c), (await body(c, z.object({ note: z.string().max(300) }))).note)));
  app.get('/v1/admin/withdrawals', async (c) => c.json(await admin.listWithdrawals(db, z.enum(['requested', 'paid', 'rejected']).default('requested').parse(c.req.query('status')))));
  app.post('/v1/admin/withdrawals/:id', async (c) => {
    const b = await body(c, z.union([z.object({ paid: z.literal(true), reference: z.string().min(1).max(80) }), z.object({ paid: z.literal(false), note: z.string().max(300) })]));
    return c.json(await money.decideWithdrawal(db, me(c).id, uuid(c), b));
  });
  app.get('/v1/admin/ledger', async (c) => c.json(await admin.listLedger(db)));
  app.get('/v1/admin/settings', async (c) => c.json(await getSettings(db)));
  app.put('/v1/admin/settings', async (c) => {
    const patch = await body(
      c,
      z
        .object({
          commissionBps: z.number().int().min(0).max(5000),
          commissionMode: z.enum(['on_top', 'deducted']),
          cancelWindowHours: z.number().min(0).max(72),
          radiusKm: z.number().min(1).max(100),
          geofenceM: z.number().int().min(50).max(5000),
          reminderLeadHours: z.number().min(0).max(24),
          minWithdrawalPaise: z.number().int().min(0),
        })
        .partial(),
    );
    const s = await updateSettings(db, patch);
    await db.insert(schema.auditLog).values({ adminId: me(c).id, action: 'settings_updated', target: 'settings', detail: patch });
    return c.json(s);
  });
  app.get('/v1/admin/audit', async (c) => c.json(await admin.listAudit(db)));

  return app;
}
