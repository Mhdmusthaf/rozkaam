// Checks every API address the admin panel's live data layer uses.
//
//   API_URL=http://localhost:4100 node scripts/check-api.mjs
//
// It starts nothing itself. Point it at a running Rozkaam API that uses the
// sandbox sign-in code and a THROWAWAY database: to have something to act on
// it signs up a test business and two test workers and posts two requirements.
// It prints one line per call and exits with code 1 if any answer is unexpected.

const API = (process.env.API_URL ?? '').replace(/\/+$/, '');
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '9847000001';
const CODE = process.env.OTP_CODE ?? '123456';
if (!API) {
  console.error('Set API_URL, e.g. API_URL=http://localhost:4100');
  process.exit(2);
}

let failed = 0;
const line = (ok, method, path, status, note = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(status).padEnd(3)} ${method.padEnd(4)} ${path}${note ? `   (${note})` : ''}`);
};

/** Calls the API and checks the status code against what the panel expects. */
async function call(method, path, token, body, expect = 200, note = '') {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
  const want = Array.isArray(expect) ? expect : [expect];
  line(want.includes(res.status), method, path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'), res.status, note || (json?.error ? json.error.code : ''));
  return json;
}

async function signIn(phone, role) {
  await call('POST', '/v1/auth/otp/request', undefined, { phone }, 200, `${role} code`);
  const r = await call('POST', '/v1/auth/otp/verify', undefined, { phone, code: CODE, role }, 200, `${role} sign-in`);
  if (!r?.token) throw new Error(`Could not sign in as ${role} ${phone}. Is the API in sandbox mode with ${ADMIN_PHONE} as an admin phone?`);
  return r.token;
}

async function upload(token) {
  const form = new FormData();
  // A 1x1 PNG, enough to be a real image file.
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  form.append('file', new File([png], 'doc.png', { type: 'image/png' }));
  const res = await fetch(`${API}/v1/uploads`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  line(res.status === 200, 'POST', '/v1/uploads', res.status, 'test document');
  return (await res.json()).key;
}

// India time parts for "now + minutes", for a requirement that starts soon.
const ist = (plusMin) => {
  const d = new Date(Date.now() + plusMin * 60_000 + 5.5 * 3600_000);
  return { date: d.toISOString().slice(0, 10), hm: d.toISOString().slice(11, 16) };
};

const VENUE = { lat: 9.9816, lng: 76.2999 };
// Unique test numbers per run so the script can be run again on the same database.
const run = String(Date.now()).slice(-6);
const phones = { business: `98${run}11`, w1: `97${run}21`, w2: `96${run}31` };

console.log(`Checking ${API}\n`);
console.log('--- sign-in');
const admin = await signIn(ADMIN_PHONE, 'admin');
await call('GET', '/v1/me', admin);

console.log('\n--- every list the panel loads');
const READS = [
  '/v1/admin/dashboard', '/v1/admin/settings', '/v1/admin/users/worker', '/v1/admin/users/business', '/v1/admin/jobs', '/v1/admin/ledger', '/v1/admin/audit',
  ...['pending', 'rejected', 'verified'].flatMap((s) => [`/v1/admin/kyc/worker?status=${s}`, `/v1/admin/kyc/business?status=${s}`]),
  ...['requested', 'paid', 'rejected'].map((s) => `/v1/admin/withdrawals?status=${s}`),
  ...['open', 'accepted', 'no_show'].map((s) => `/v1/admin/flags?state=${s}`),
];
for (const p of READS) await call('GET', p, admin);

console.log('\n--- test data: a business and two workers sign up');
const biz = await signIn(phones.business, 'business');
const bizDoc = await upload(biz);
await call('PUT', '/v1/business/profile', biz, { name: `Check Events ${run}`, type: 'Event management', address: '12 Test Road, Kochi 682016', district: 'Ernakulam', contactName: 'Test Manager', email: 'ops@test.example', docRegistrationKey: bizDoc, docIdKey: bizDoc });
const bizProfile = await call('POST', '/v1/business/kyc/submit', biz, {}, 200, 'business submits KYC');

const workers = [];
for (const [i, phone] of [phones.w1, phones.w2].entries()) {
  const t = await signIn(phone, 'worker');
  const doc = await upload(t);
  await call('PUT', '/v1/worker/profile', t, { name: `Check Worker ${i + 1}`, dob: '14/08/2002', gender: 'Male', district: 'Ernakulam', area: 'Kaloor', ...VENUE, skills: ['Food service'], experience: 'Under 1 year', idType: 'Voter ID', idNumber: 'TEST123456', idPhotoKey: doc, selfieKey: doc, bankName: `Check Worker ${i + 1}`, accountNumber: '000011112222', ifsc: 'TEST0123456', upi: 'test@upi' });
  await call('POST', '/v1/worker/kyc/submit', t, {}, 200, 'worker submits KYC');
  const me = await call('GET', '/v1/me', t);
  workers.push({ token: t, id: me.id, doc });
}

console.log('\n--- KYC queues: read, open a document, reject with a reason, approve');
const pendingBiz = await call('GET', '/v1/admin/kyc/business?status=pending', admin);
line(pendingBiz.some((r) => r.business.id === bizProfile.id), 'GET', '(business appears in the pending queue)', '-');
const fileRes = await fetch(`${API}/v1/files/${bizDoc}`, { headers: { authorization: `Bearer ${admin}` } });
line(fileRes.status === 200 && fileRes.headers.get('content-type') === 'image/png', 'GET', '/v1/files/:key', fileRes.status, 'private KYC document as a blob');
await call('POST', `/v1/admin/kyc/business/${bizProfile.id}`, admin, { approve: false }, 400, 'reject needs a reason');
await call('POST', `/v1/admin/kyc/business/${bizProfile.id}`, admin, { approve: true });
await call('POST', `/v1/admin/kyc/worker/${workers[0].id}`, admin, { approve: true });
await call('POST', `/v1/admin/kyc/worker/${workers[1].id}`, admin, { approve: false, note: 'ID photo is blurred' }, 200, 'reject');
await call('POST', `/v1/admin/kyc/worker/${workers[1].id}`, admin, { approve: true }, 200, 'approve from the rejected tab');

console.log('\n--- requirements and applicant approval');
const start = ist(90);
const report = ist(60);
const end = ist(300);
const draft = (title, needed) => ({ title, category: 'Events', workDate: start.date, reportTime: report.date === start.date ? report.hm : '00:00', startTime: start.hm, endTime: end.hm, payPaise: 80000, needed, venue: 'Check Hall', ...VENUE, pocName: 'Test Contact', pocPhone: '9000000000' });
const jobA = await call('POST', '/v1/business/jobs', biz, draft(`Check ushers ${run}`, 1), 201, 'business posts');
await call('POST', `/v1/business/jobs/${jobA.id}/fund`, biz, {}, 200, 'business funds (sandbox)');
const jobB = await call('POST', '/v1/business/jobs', biz, draft(`Check crew ${run}`, 1), 201);
await call('POST', `/v1/business/jobs/${jobB.id}/fund`, biz, {});
const appA1 = await call('POST', `/v1/worker/jobs/${jobA.id}/apply`, workers[0].token, {}, 201, 'worker 1 applies');
const appA2 = await call('POST', `/v1/worker/jobs/${jobA.id}/apply`, workers[1].token, {}, 201, 'worker 2 applies');
const appB2 = await call('POST', `/v1/worker/jobs/${jobB.id}/apply`, workers[1].token, {}, 201);

const detail = await call('GET', `/v1/admin/jobs/${jobA.id}`, admin);
const pending = detail.roster.filter((r) => r.status === 'applied');
line(pending.length === 2 && pending.every((r) => r.applicationId && typeof r.reliability === 'number'), 'GET', '(roster lists pending applicants with applicationId and reliability)', '-');
await call('POST', `/v1/admin/applications/${appA1.id}/decide`, admin, { decision: 'approve' });
await call('POST', `/v1/admin/applications/${appA2.id}/decide`, admin, { decision: 'approve' }, 409, 'requirement is full');
await call('POST', `/v1/admin/applications/${appA2.id}/decide`, admin, { decision: 'waitlist' });
await call('POST', `/v1/admin/applications/${appA2.id}/decide`, admin, { decision: 'reject' }, 200, 'reject from the waitlist');
await call('POST', `/v1/admin/applications/${appB2.id}/decide`, admin, { decision: 'approve' });

console.log('\n--- attendance flags');
await call('POST', `/v1/worker/applications/${appA1.id}/check-in`, workers[0].token, { photoKey: null, lat: 9.9906, lng: 76.2999 }, 201, 'check-in without a photo, 1 km away');
const flags = await call('GET', '/v1/admin/flags?state=open', admin);
const flag = flags.find((f) => f.applicationId === appA1.id);
line(!!flag, 'GET', '(the check-in appears as an open flag)', '-');
if (flag) await call('POST', `/v1/admin/flags/${flag.attendance.id}`, admin, { accept: true }, 200, 'accept flag');

console.log('\n--- strikes and account status');
await call('POST', `/v1/worker/applications/${appB2.id}/cancel`, workers[1].token, {}, 200, 'late cancellation by worker 2');
const strikes = await call('GET', `/v1/admin/workers/${workers[1].id}/strikes`, admin);
line(strikes.length === 1, 'GET', '(the late cancellation is a strike)', '-');
if (strikes[0]) {
  await call('POST', `/v1/admin/strikes/${strikes[0].strike.id}/excuse`, admin, { note: '' }, 400, 'excuse needs a note');
  await call('POST', `/v1/admin/strikes/${strikes[0].strike.id}/excuse`, admin, { note: 'Genuine emergency, checked by ops' });
}
await call('POST', `/v1/admin/users/${workers[1].id}/status`, admin, { status: 'suspended', note: 'Check script' });
await call('POST', `/v1/admin/users/${workers[1].id}/status`, admin, { status: 'active', note: 'Check script' });
const bizUsers = await call('GET', '/v1/admin/users/business', admin);
const owner = bizUsers.find((u) => u.businessId === bizProfile.id);
line(!!owner, 'GET', '(business list gives the owner account id for status changes)', '-');
if (owner) {
  await call('POST', `/v1/admin/users/${owner.id}/status`, admin, { status: 'restricted', note: 'Check script' });
  await call('POST', `/v1/admin/users/${owner.id}/status`, admin, { status: 'active', note: 'Check script' });
}

console.log('\n--- withdrawals (no paid work exists in this short run, so only the addresses are checked)');
const none = '00000000-0000-4000-8000-000000000000';
await call('POST', `/v1/admin/withdrawals/${none}`, admin, { paid: true, reference: 'CHECK' }, 404, 'no such withdrawal');
await call('POST', `/v1/admin/withdrawals/${none}`, admin, { paid: false, note: 'Check' }, 404, 'no such withdrawal');

console.log('\n--- settings, ledger, audit');
const s = await call('GET', '/v1/admin/settings', admin);
await call('PUT', '/v1/admin/settings', admin, { commissionBps: s.commissionBps, commissionMode: s.commissionMode, cancelWindowHours: s.cancelWindowHours, radiusKm: s.radiusKm, geofenceM: s.geofenceM, reminderLeadHours: s.reminderLeadHours });
const ledger = await call('GET', '/v1/admin/ledger', admin);
line(ledger.filter((l) => l.type === 'funding').length >= 2, 'GET', '(ledger shows the two fundings)', '-');
const audit = await call('GET', '/v1/admin/audit', admin);
line(audit.length >= 10, 'GET', `(audit log recorded ${audit.length} admin actions)`, '-');
const dash = await call('GET', '/v1/admin/dashboard', admin);
line(typeof dash.gmvPaise === 'number' && typeof dash.revenuePaise === 'number' && typeof dash.payoutsPaise === 'number', 'GET', '(dashboard keeps GMV, revenue and payouts as separate numbers)', '-');

console.log('\n--- things the panel wants that the server does not have yet');
await call('POST', `/v1/admin/jobs/${jobB.id}/cancel`, admin, { reason: 'Check' }, 404, 'gap: admin cannot cancel a requirement');
await call('POST', `/v1/admin/applications/${appA1.id}/remove`, admin, {}, 404, 'gap: admin cannot remove a confirmed worker');

console.log('\n--- sign-out');
await call('POST', '/v1/auth/sign-out', admin, {});
await call('GET', '/v1/me', admin, undefined, 401, 'token no longer works');

console.log(failed ? `\n${failed} unexpected answer(s).` : '\nAll answers were as expected.');
process.exit(failed ? 1 : 0);
