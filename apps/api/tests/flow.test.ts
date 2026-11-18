// End-to-end test of the whole Rozkaam loop through the HTTP API, on an
// in-memory database with a controlled clock.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { openDb } from '../src/db/client';
import { setNow } from '../src/lib/clock';

let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;

const VENUE = { lat: 9.9816, lng: 76.2999 };
const at = (iso: string) => setNow(new Date(iso));

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as any };
}

async function signIn(phone: string, role: 'worker' | 'business' | 'admin') {
  expect((await call('POST', '/v1/auth/otp/request', undefined, { phone })).status).toBe(200);
  const r = await call('POST', '/v1/auth/otp/verify', undefined, { phone, code: '123456', role });
  expect(r.status).toBe(200);
  return r.json.token as string;
}

async function upload(token: string) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' }));
  const res = await app.request('/v1/uploads', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  expect(res.status).toBe(200);
  return ((await res.json()) as any).key as string;
}

async function newWorker(phone: string, name: string, admin: string) {
  const t = await signIn(phone, 'worker');
  const key = await upload(t);
  const put = await call('PUT', '/v1/worker/profile', t, {
    name,
    dob: '14/08/2002',
    gender: 'Male',
    district: 'Ernakulam',
    area: 'Kaloor',
    lat: VENUE.lat,
    lng: VENUE.lng,
    skills: ['Food service'],
    experience: 'Under 1 year',
    idType: 'Voter ID',
    idNumber: 'TEST123456',
    idPhotoKey: key,
    selfieKey: key,
    bankName: name,
    accountNumber: '000011112222',
    ifsc: 'TEST0123456',
    upi: 'test@upi',
  });
  expect(put.status).toBe(200);
  const sub = await call('POST', '/v1/worker/kyc/submit', t);
  expect(sub.json.kycStatus).toBe('pending');
  const me = await call('GET', '/v1/me', t);
  expect((await call('POST', `/v1/admin/kyc/worker/${me.json.id}`, admin, { approve: true })).json.kycStatus).toBe('verified');
  return { token: t, id: me.json.id as string, photo: key };
}

beforeAll(async () => {
  const opened = await openDb();
  app = createApp(opened.db);
  close = opened.close;
  at('2026-11-18T10:00:00+05:30');
});
afterAll(async () => {
  setNow(null);
  await close();
});

describe('the full loop', () => {
  let admin: string, biz: string, jobId: string;
  let w: { token: string; id: string; photo: string }[] = [];
  const apps: string[] = [];

  it('guards sign-in and roles', async () => {
    expect((await call('GET', '/v1/me')).status).toBe(401);
    expect((await call('POST', '/v1/auth/otp/request', undefined, { phone: '12345' })).status).toBe(400);
    await call('POST', '/v1/auth/otp/request', undefined, { phone: '9847055555' });
    expect((await call('POST', '/v1/auth/otp/verify', undefined, { phone: '9847055555', code: '000000', role: 'worker' })).json.error.code).toBe('otp_wrong');
    // A normal number cannot become an admin.
    await call('POST', '/v1/auth/otp/request', undefined, { phone: '9847066666' });
    expect((await call('POST', '/v1/auth/otp/verify', undefined, { phone: '9847066666', code: '123456', role: 'admin' })).status).toBe(403);
    admin = await signIn('9847000001', 'admin');
    const stranger = await signIn('9847055555', 'worker');
    expect((await call('GET', '/v1/admin/dashboard', stranger)).status).toBe(403);
    // One number, one kind of account.
    await call('POST', '/v1/auth/otp/request', undefined, { phone: '9847055555' });
    expect((await call('POST', '/v1/auth/otp/verify', undefined, { phone: '9847055555', code: '123456', role: 'business' })).json.error.code).toBe('role_mismatch');
  });

  it('verifies a business and blocks posting before that', async () => {
    biz = await signIn('9847000011', 'business');
    const draft = { title: 'Catering crew', category: 'Catering', workDate: '2026-11-20', reportTime: '09:30', startTime: '10:00', endTime: '18:00', payPaise: 800_00, needed: 3, venue: 'Lake Pavilion', ...VENUE, pocName: 'Reena', pocPhone: '9000000000' };
    expect((await call('POST', '/v1/business/jobs', biz, draft)).status).toBe(403);
    const key = await upload(biz);
    await call('PUT', '/v1/business/profile', biz, { name: 'Test Events Co', type: 'Catering', address: '12 Test Road, Kochi', district: 'Ernakulam', contactName: 'Test Manager', email: 'ops@test.example', docRegistrationKey: key, docIdKey: key });
    const sub = await call('POST', '/v1/business/kyc/submit', biz);
    expect(sub.json.kycStatus).toBe('pending');
    expect((await call('POST', `/v1/admin/kyc/business/${sub.json.id}`, admin, { approve: false })).json.error.code).toBe('reason_required');
    expect((await call('POST', `/v1/admin/kyc/business/${sub.json.id}`, admin, { approve: true })).json.kycStatus).toBe('verified');

    const created = await call('POST', '/v1/business/jobs', biz, draft);
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ status: 'awaiting_funding', commissionBps: 1500, commissionMode: 'on_top' });
    jobId = created.json.id;
  });

  it('hides unfunded jobs, then funds 3 x (800 + 15%)', async () => {
    w = [await newWorker('9847011111', 'Worker One', admin), await newWorker('9847022222', 'Worker Two', admin), await newWorker('9847033333', 'Worker Three', admin), await newWorker('9847044444', 'Worker Four', admin)];
    expect((await call('GET', '/v1/worker/jobs', w[0]!.token)).json).toHaveLength(0);
    expect((await call('POST', `/v1/business/jobs/${jobId}/fund`, biz)).json.status).toBe('open');
    expect((await call('POST', `/v1/business/jobs/${jobId}/fund`, biz)).json.error.code).toBe('already_funded');
    expect((await call('GET', '/v1/business/payments', biz)).json.fundedPaise).toBe(2760_00);
    const feed = (await call('GET', '/v1/worker/jobs', w[0]!.token)).json;
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ workerPayPaise: 800_00, slotsLeft: 3, contact: null, distanceM: 0 });
    expect(feed[0].pocPhone).toBeUndefined();
  });

  it('lets workers apply and the ops team confirm until full', async () => {
    for (const x of w) {
      const r = await call('POST', `/v1/worker/jobs/${jobId}/apply`, x.token);
      expect(r.status).toBe(201);
      apps.push(r.json.id);
    }
    expect((await call('POST', `/v1/worker/jobs/${jobId}/apply`, w[0]!.token)).json.error.code).toBe('already_applied');
    // Only admins decide, never the business or the worker.
    expect((await call('POST', `/v1/admin/applications/${apps[0]}/decide`, biz, { decision: 'approve' })).status).toBe(403);
    for (const id of apps.slice(0, 3)) expect((await call('POST', `/v1/admin/applications/${id}/decide`, admin, { decision: 'approve' })).json.status).toBe('confirmed');
    expect((await call('POST', `/v1/admin/applications/${apps[3]}/decide`, admin, { decision: 'approve' })).json.error.code).toBe('full');
    expect((await call('POST', `/v1/admin/applications/${apps[3]}/decide`, admin, { decision: 'waitlist' })).json.status).toBe('waitlisted');

    const job = (await call('GET', `/v1/business/jobs/${jobId}`, biz)).json;
    expect(job).toMatchObject({ status: 'filled', confirmed: 3 });
    expect(job.roster.map((r: any) => r.status).sort()).toEqual(['confirmed', 'confirmed', 'confirmed', 'waitlisted']);
    expect(JSON.stringify(job.roster)).not.toContain('98470'); // no phone numbers
    // The contact person appears for the worker only after confirmation.
    expect((await call('GET', `/v1/worker/applications/${apps[0]}`, w[0]!.token)).json.job.contact).toEqual({ name: 'Reena', phone: '9000000000' });
    expect((await call('GET', `/v1/worker/applications/${apps[3]}`, w[3]!.token)).json.job.contact).toBeNull();
  });

  it('records attendance with server time, distance and flags', async () => {
    expect((await call('POST', `/v1/worker/applications/${apps[0]}/check-in`, w[0]!.token, { photoKey: w[0]!.photo, ...VENUE })).json.error.code).toBe('too_early');
    at('2026-11-20T09:20:00+05:30');
    const good = await call('POST', `/v1/worker/applications/${apps[0]}/check-in`, w[0]!.token, { photoKey: w[0]!.photo, ...VENUE });
    expect(good.json).toMatchObject({ distanceM: 0, flag: 'none', late: false });
    expect(new Date(good.json.at).toISOString()).toBe('2026-11-20T03:50:00.000Z');
    at('2026-11-20T09:50:00+05:30');
    const far = await call('POST', `/v1/worker/applications/${apps[1]}/check-in`, w[1]!.token, { photoKey: w[1]!.photo, lat: 9.9906, lng: 76.2999 });
    expect(far.json).toMatchObject({ flag: 'open', late: true });
    expect(far.json.flagReason).toMatch(/m from venue/);
    expect((await call('GET', '/v1/admin/flags', admin)).json).toHaveLength(1);
    expect((await call('POST', `/v1/admin/flags/${far.json.id}`, admin, { accept: true })).json.flag).toBe('accepted');
    expect((await call('GET', `/v1/business/jobs/${jobId}`, biz)).json.status).toBe('in_progress');
    // The waitlisted worker cannot check in.
    expect((await call('POST', `/v1/worker/applications/${apps[3]}/check-in`, w[3]!.token, { photoKey: 'x', ...VENUE })).json.error.code).toBe('not_confirmed');

    at('2026-11-20T18:05:00+05:30');
    for (const i of [0, 1]) expect((await call('POST', `/v1/worker/applications/${apps[i]}/check-out`, w[i]!.token, { photoKey: w[i]!.photo, ...VENUE })).status).toBe(201);
  });

  it('settles: pays those who worked, strikes the no-show, refunds the unused slot', async () => {
    expect((await call('POST', `/v1/business/jobs/${jobId}/approve-attendance`, w[0]!.token)).status).toBe(403);
    const s = (await call('POST', `/v1/business/jobs/${jobId}/approve-attendance`, biz)).json;
    expect(s).toMatchObject({ funded: 2760_00, payouts: 1600_00, commission: 240_00, refund: 920_00, gmv: 1600_00, workersPaid: 2, noShows: 1 });
    expect((await call('POST', `/v1/business/jobs/${jobId}/approve-attendance`, biz)).json.error.code).toBe('cannot_approve');

    expect((await call('GET', '/v1/worker/wallet', w[0]!.token)).json.balancePaise).toBe(800_00);
    const third = (await call('GET', '/v1/worker/profile', w[2]!.token)).json;
    expect(third).toMatchObject({ activeStrikes: 1, reliability: 92 });
    expect((await call('GET', '/v1/business/payments', biz)).json).toMatchObject({ fundedPaise: 2760_00, refundedPaise: 920_00, netSpendPaise: 1840_00 });

    const d = (await call('GET', '/v1/admin/dashboard', admin)).json;
    expect(d).toMatchObject({ gmvPaise: 1600_00, revenuePaise: 240_00, payoutsPaise: 1600_00 });
    expect(d.noShowRate).toBeCloseTo(1 / 3);
  });

  it('handles ratings both ways, once each', async () => {
    expect((await call('POST', `/v1/worker/applications/${apps[0]}/rate`, w[0]!.token, { stars: 5 })).status).toBe(200);
    expect((await call('POST', `/v1/worker/applications/${apps[0]}/rate`, w[0]!.token, { stars: 1 })).json.error.code).toBe('already_rated');
    expect((await call('POST', `/v1/business/applications/${apps[0]}/rate`, biz, { stars: 4 })).status).toBe(200);
    expect((await call('GET', '/v1/worker/profile', w[0]!.token)).json).toMatchObject({ rating: 4, jobsDone: 1, minutesWorked: 480 });
    expect((await call('GET', '/v1/business/profile', biz)).json.rating).toBe(5);
  });

  it('never lets a wallet go below zero', async () => {
    const t = w[0]!.token;
    expect((await call('POST', '/v1/worker/withdrawals', t, { amountPaise: 50_00, to: 'upi' })).json.error.code).toBe('below_minimum');
    const first = await call('POST', '/v1/worker/withdrawals', t, { amountPaise: 500_00, to: 'upi' });
    expect(first.status).toBe(201);
    expect((await call('POST', '/v1/worker/withdrawals', t, { amountPaise: 400_00, to: 'upi' })).json.error.code).toBe('insufficient');
    const second = await call('POST', '/v1/worker/withdrawals', t, { amountPaise: 300_00, to: 'bank' });
    expect((await call('GET', '/v1/worker/wallet', t)).json).toMatchObject({ balancePaise: 0, processingPaise: 800_00 });
    expect((await call('POST', `/v1/admin/withdrawals/${first.json.id}`, admin, { paid: true, reference: 'TESTREF1' })).json.status).toBe('paid');
    expect((await call('POST', `/v1/admin/withdrawals/${second.json.id}`, admin, { paid: false, note: 'Bank details did not match' })).json.status).toBe('rejected');
    // The rejected amount is available again; the paid one is gone.
    expect((await call('GET', '/v1/worker/wallet', t)).json).toMatchObject({ balancePaise: 300_00, withdrawnPaise: 500_00, processingPaise: 0 });
    expect((await call('POST', `/v1/admin/withdrawals/${first.json.id}`, admin, { paid: true, reference: 'AGAIN' })).json.error.code).toBe('already_decided');
  });

  it('applies the 12-hour cancellation rule and escalates repeat strikes', async () => {
    const mk = async (date: string) => {
      const j = await call('POST', '/v1/business/jobs', biz, { title: 'Ushers', category: 'Events', workDate: date, reportTime: '09:30', startTime: '10:00', endTime: '14:00', payPaise: 700_00, needed: 1, venue: 'Hall', ...VENUE });
      await call('POST', `/v1/business/jobs/${j.json.id}/fund`, biz);
      return j.json.id as string;
    };
    const confirm = async (job: string, who: number) => {
      const a = await call('POST', `/v1/worker/jobs/${job}/apply`, w[who]!.token);
      await call('POST', `/v1/admin/applications/${a.json.id}/decide`, admin, { decision: 'approve' });
      return a.json.id as string;
    };
    // Early cancel: free.
    const j1 = await mk('2026-11-25');
    const a1 = await confirm(j1, 0);
    expect((await call('POST', `/v1/worker/applications/${a1}/cancel`, w[0]!.token)).json.status).toBe('cancelled');
    expect((await call('GET', '/v1/admin/jobs/' + j1, admin)).json.status).toBe('open');
    // Late cancel: strike. Worker Three already has one, so this restricts them.
    const a2 = await confirm(j1, 2);
    at('2026-11-25T01:00:00+05:30');
    expect((await call('POST', `/v1/worker/applications/${a2}/cancel`, w[2]!.token)).json.status).toBe('late_cancel');
    const p = (await call('GET', '/v1/worker/profile', w[2]!.token)).json;
    expect(p).toMatchObject({ activeStrikes: 2, reliability: 84, accountStatus: 'restricted' });

    // Excusing a strike restores the standing, with a required note, and is audited.
    const strikes = (await call('GET', `/v1/admin/workers/${w[2]!.id}/strikes`, admin)).json;
    expect((await call('POST', `/v1/admin/strikes/${strikes[0].strike.id}/excuse`, admin, { note: '' })).json.error.code).toBe('note_required');
    expect((await call('POST', `/v1/admin/strikes/${strikes[0].strike.id}/excuse`, admin, { note: 'Hospital visit, proof shared' })).json.activeStrikes).toBe(1);
    expect((await call('GET', '/v1/worker/profile', w[2]!.token)).json.accountStatus).toBe('active');
    const log = (await call('GET', '/v1/admin/audit', admin)).json.map((e: any) => e.entry.action);
    expect(log).toEqual(expect.arrayContaining(['strike_excused', 'withdrawal_paid', 'application_approve', 'kyc_worker_approved', 'flag_accepted']));
  });

  it('keeps old jobs on their own terms when settings change, and refunds a cancellation in full', async () => {
    expect((await call('PUT', '/v1/admin/settings', admin, { commissionBps: 2000, commissionMode: 'deducted' })).json).toMatchObject({ commissionBps: 2000, commissionMode: 'deducted' });
    const j = await call('POST', '/v1/business/jobs', biz, { title: 'Packers', category: 'Logistics', workDate: '2026-11-28', reportTime: '08:30', startTime: '09:00', endTime: '17:00', payPaise: 1000_00, needed: 4, venue: 'Hub', ...VENUE });
    expect(j.json).toMatchObject({ commissionBps: 2000, commissionMode: 'deducted' });
    await call('POST', `/v1/business/jobs/${j.json.id}/fund`, biz);
    const seen = (await call('GET', '/v1/worker/jobs', w[1]!.token)).json.find((x: any) => x.id === j.json.id);
    expect(seen.workerPayPaise).toBe(800_00); // 1000 - 20%
    const before = (await call('GET', '/v1/business/payments', biz)).json;
    expect((await call('POST', `/v1/business/jobs/${j.json.id}/cancel`, biz)).json.status).toBe('cancelled');
    const after = (await call('GET', '/v1/business/payments', biz)).json;
    expect(after.refundedPaise - before.refundedPaise).toBe(4000_00);
    // The first job kept the terms it was posted under.
    expect((await call('GET', `/v1/admin/jobs/${jobId}`, admin)).json).toMatchObject({ commissionBps: 1500, commissionMode: 'on_top' });
  });

  it('protects private files', async () => {
    const key = w[0]!.photo;
    const get = (token: string) => app.request(`/v1/files/${key}`, { headers: { authorization: `Bearer ${token}` } });
    expect((await get(w[0]!.token)).status).toBe(200); // owner
    expect((await get(admin)).status).toBe(200); // ops team
    expect((await get(biz)).status).toBe(200); // check-in photo on this business's job
    expect((await get(w[1]!.token)).status).toBe(404); // another worker
  });
});
