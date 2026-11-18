// Runs the panel's real live data layer (src/data/live.ts) against an API and
// prints what it mapped, so the mapping can be checked without a browser.
//
//   API_URL=http://localhost:4100 node scripts/check-live-mapping.mjs
//
// Run scripts/check-api.mjs first so the database has something in it.
import { createServer } from 'vite';

const API = (process.env.API_URL ?? '').replace(/\/+$/, '');
if (!API) {
  console.error('Set API_URL, e.g. API_URL=http://localhost:4100');
  process.exit(2);
}
process.env.VITE_API_URL = API;

// The panel keeps its token in sessionStorage; give Node a stand-in.
const mem = new Map();
globalThis.sessionStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let failed = 0;
const check = (ok, text) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

try {
  const client = await vite.ssrLoadModule('/src/api/client.ts');
  const live = await vite.ssrLoadModule('/src/data/live.ts');
  check(client.LIVE === true, `live mode is on for ${client.API_URL}`);

  await live.requestCode(process.env.ADMIN_PHONE ?? '9847000001');
  const session = await live.verifyCode(process.env.ADMIN_PHONE ?? '9847000001', process.env.OTP_CODE ?? '123456');
  client.setSession(session.token, session.user.phone);

  const snap = await live.loadLive();
  const { db, dashboard, refs } = snap;
  console.log(`\nLoaded: ${db.workers.length} workers, ${db.businesses.length} businesses, ${db.requirements.length} requirements, ${db.applications.length} applications, ${db.withdrawals.length} withdrawals, ${db.ledger.length} ledger rows, ${db.audit.length} audit entries\n`);

  const w = db.workers.find((x) => x.name.startsWith('Check Worker'));
  check(!!w, 'a signed-up worker is mapped');
  if (w) {
    check(w.phone.startsWith('+91 ') && w.age >= 18 && w.district === 'Ernakulam' && w.skills.length > 0, `worker details: ${w.name}, ${w.phone}, age ${w.age}, ${w.area}, ${w.district}`);
    check(w.kyc === 'verified' && w.kycDocType === 'Voter ID' && w.kycDocLast4 === '3456', `worker KYC: ${w.kyc}, ${w.kycDocType} ending ${w.kycDocLast4}`);
    check(!!w.idPhotoKey && !!w.selfieKey, 'worker KYC file keys are carried for the document viewer');
  }
  const struck = db.workers.find((x) => x.strikes.length > 0);
  check(!!struck && struck.strikes[0].reason === 'Late cancellation' && struck.strikes[0].excused === true && struck.reliability === 100, `strike mapped: ${struck?.strikes[0]?.reason}, excused ${struck?.strikes[0]?.excused}, reliability ${struck?.reliability}`);

  const b = db.businesses.find((x) => x.name.startsWith('Check Events'));
  check(!!b && b.kyc === 'verified' && b.docs.length === 2 && !!b.docKeys?.['Registration proof'], `business mapped: ${b?.name}, ${b?.category}, docs ${b?.docs.join(' + ')}`);
  check(!!b && !!refs.businessOwner[b.id], 'business has its owner account id for status changes');

  const r = db.requirements.find((x) => x.title.startsWith('Check ushers'));
  check(!!r && r.pay === 800 && r.commissionRate === 15 && r.commissionMode === 'on_top' && r.funded === true, `requirement money: pay ₹${r?.pay}, ${r?.commissionRate}% ${r?.commissionMode}, funded ${r?.funded}`);
  check(!!r && /^\d{1,2}:\d{2} (AM|PM)$/.test(r.startTime) && /^\d{4}-\d{2}-\d{2}$/.test(r.date), `requirement time: ${r?.date}, report ${r?.reportTime}, ${r?.startTime} – ${r?.endTime}`);
  check(!!r && db.businesses.some((x) => x.id === r.businessId), 'every requirement points at a known business');
  check(db.applications.every((a) => db.workers.some((x) => x.id === a.workerId) && db.requirements.some((x) => x.id === a.reqId)), 'every application points at a known worker and requirement');

  const apps = r ? db.applications.filter((a) => a.reqId === r.id) : [];
  const inApp = apps.find((a) => a.checkIn);
  check(apps.some((a) => a.status === 'checked_in') && apps.some((a) => a.status === 'rejected'), `application statuses mapped: ${apps.map((a) => a.status).join(', ')}`);
  check(!!inApp && inApp.checkIn.flag === 'photo' && inApp.checkIn.resolved === 'accepted' && inApp.checkIn.photo === false, `flag mapped: ${inApp?.checkIn?.flag}, reason "${inApp?.checkIn?.reason}", resolved ${inApp?.checkIn?.resolved}, ${inApp?.checkIn?.distanceM} m`);
  check(!!inApp && !!refs.flagAttendance[inApp.id], 'flagged application has its attendance id for resolving');
  check(db.applications.some((a) => a.status === 'late_cancel'), 'late cancellation is mapped');

  const funding = db.ledger.filter((l) => l.type === 'funding');
  check(funding.length >= 2 && funding.every((l) => l.amount === 920), `ledger in rupees: fundings of ₹${funding.map((l) => l.amount).join(', ₹')}`);
  check(!db.ledger.some((l) => l.type === 'withdrawal'), 'withdrawal rows are kept out of the ledger page');
  check(db.settings.commissionRate === 15 && db.settings.reminderHours === 2, `settings: ${db.settings.commissionRate}% ${db.settings.commissionMode}, cancel ${db.settings.cancelWindowHours} h, radius ${db.settings.radiusKm} km, geofence ${db.settings.geofenceM} m`);
  check(db.audit.length > 0 && db.audit.some((a) => a.target.includes('Check')), `audit names are readable: "${db.audit[0]?.action}" → "${db.audit[0]?.target}"`);
  check(typeof dashboard.gmvPaise === 'number' && typeof dashboard.revenuePaise === 'number' && typeof dashboard.payoutsPaise === 'number', `dashboard totals: GMV ₹${dashboard.gmvPaise / 100}, revenue ₹${dashboard.revenuePaise / 100}, payouts ₹${dashboard.payoutsPaise / 100}, funded ₹${dashboard.fundedPaise / 100}`);

  // The save path: settings go back as basis points and the server keeps them.
  await live.actions.saveSettings({ ...db.settings, commissionRate: 17.5 });
  const after = await live.loadLive();
  check(after.db.settings.commissionRate === 17.5, `settings save round-trips: 17.5% -> ${after.db.settings.commissionRate}%`);
  await live.actions.saveSettings(db.settings);
} catch (e) {
  failed++;
  console.error('FAIL', e);
} finally {
  await vite.close();
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nThe live data layer mapped everything as expected.');
process.exit(failed ? 1 : 0);
