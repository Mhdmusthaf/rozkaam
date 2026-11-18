import { useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDate, inr, titleCase } from '../data/format';
import type { AccountStatus } from '../data/types';
import { AccountPill, AppPill, Drawer, Empty, KycPill, Meter, PageHead, Person, Pill, PromptModal, Rating } from '../ui';

export function StatusActions({ status, onPick }: { status: AccountStatus; onPick: (s: AccountStatus) => void }) {
  return (
    <div className="row wrap">
      {status !== 'active' && <button className="btn ok sm" onClick={() => onPick('active')}>Reinstate</button>}
      {status !== 'restricted' && status !== 'banned' && <button className="btn ghost sm" onClick={() => onPick('restricted')}>Restrict</button>}
      {status !== 'suspended' && status !== 'banned' && <button className="btn ghost sm" onClick={() => onPick('suspended')}>Suspend</button>}
      {status !== 'banned' && <button className="btn danger sm" onClick={() => onPick('banned')}>Ban</button>}
    </div>
  );
}

export const STATUS_HELP: Record<AccountStatus, string> = {
  active: 'Full access restored.',
  restricted: 'Lower priority in matching and no urgent jobs.',
  suspended: 'Cannot apply or post until reinstated.',
  banned: 'Permanently removed from the platform.',
};

export default function Workers() {
  const { db, requirement, setWorkerStatus, excuseStrike } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [change, setChange] = useState<AccountStatus | null>(null);
  const [excuse, setExcuse] = useState<string | null>(null);

  const rows = db.workers
    .filter((w) => status === 'all' || w.status === status)
    .filter((w) => !q.trim() || `${w.id} ${w.name} ${w.phone} ${w.area} ${w.skills.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()));
  const w = db.workers.find((x) => x.id === openId);
  const history = w ? db.applications.filter((a) => a.workerId === w.id).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, 8) : [];
  const earned = w ? db.ledger.filter((l) => l.type === 'payout' && l.workerId === w.id).reduce((n, l) => n + l.amount, 0) : 0;

  return (
    <>
      <PageHead title="Workers" sub="Everyone registered as a worker. Reachable and registered counts are not the same as active workers." />
      <div className="card flush">
        <div className="card-head">
          <div className="filters grow">
            <div className="search">
              <Search size={15} />
              <input className="input" placeholder="Search name, phone, area or skill" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" aria-label="Account status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All account states</option>
              {['active', 'restricted', 'suspended', 'banned'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </div>
          <span className="muted small num">{rows.length} workers</span>
        </div>
        {rows.length === 0 ? <Empty title="No workers match" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Worker</th><th>Area</th><th>Rating</th><th>Jobs done</th><th>Reliability</th><th>Strikes</th><th>KYC</th><th>Account</th></tr></thead>
              <tbody>
                {rows.map((x) => {
                  const live = x.strikes.filter((s) => !s.excused).length;
                  return (
                    <tr key={x.id} className="click" onClick={() => setOpenId(x.id)}>
                      <td><Person name={x.name} sub={`${x.id} · ${x.phone}`} /></td>
                      <td>{x.area}</td>
                      <td><Rating value={x.rating} count={x.ratingCount} /></td>
                      <td className="num">{x.jobsDone}</td>
                      <td><Meter value={x.reliability} /></td>
                      <td>{live ? <Pill tone={live > 1 ? 'bad' : 'warn'}>{live}</Pill> : <span className="muted">0</span>}</td>
                      <td><KycPill s={x.kyc} /></td>
                      <td><AccountPill s={x.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {w && (
        <Drawer title="Worker profile" onClose={() => setOpenId(null)}>
          <div className="card">
            <div className="row">
              <div className="avatar lg">{w.name.split(' ').map((p) => p[0]).join('')}</div>
              <div className="grow">
                <h2 style={{ fontSize: 18 }}>{w.name}</h2>
                <div className="muted small">{w.id} · joined {fmtDate(w.joined)}</div>
                <div className="row gap-6 mt-8"><AccountPill s={w.status} /><KycPill s={w.kyc} /></div>
              </div>
            </div>
            <div className="grid thirds mt-16" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div><div className="muted small">Rating</div><Rating value={w.rating} count={w.ratingCount} /></div>
              <div><div className="muted small">Jobs done</div><b className="num">{w.jobsDone}</b></div>
              <div><div className="muted small">Paid out (demo period)</div><b className="num">{inr(earned)}</b></div>
            </div>
            <div className="mt-16"><div className="muted small">Reliability score</div><Meter value={w.reliability} /></div>
          </div>

          <div className="card">
            <h3>Account actions</h3>
            <p className="muted small mt-4">Every change needs a note and is written to the audit log.</p>
            <div className="mt-16"><StatusActions status={w.status} onPick={setChange} /></div>
          </div>

          <div className="card">
            <h3>Profile</h3>
            <dl className="dl mt-16">
              <dt>Phone</dt><dd className="num">{w.phone}</dd>
              <dt>Age / gender</dt><dd>{w.age || '—'} · {w.gender}</dd>
              <dt>Location</dt><dd>{w.area}, {w.district}</dd>
              <dt>Experience</dt><dd>{w.experience}</dd>
              <dt>Skills</dt><dd>{w.skills.map((s) => <span key={s} className="chip">{s}</span>)}</dd>
              <dt>ID</dt><dd className="num">{w.kycDocType} ending {w.kycDocLast4}</dd>
              <dt>Payout UPI</dt><dd className="num">{w.upi}</dd>
            </dl>
          </div>

          <div className="card flush">
            <div className="card-head"><h3>Strikes ({w.strikes.length})</h3></div>
            {w.strikes.length === 0 ? <Empty title="No strikes">A clean record.</Empty> : w.strikes.map((s) => (
              <div key={s.id} className="list-row">
                <div className="grow">
                  <b>{s.reason}</b> <span className="muted">· {s.requirement}</span>
                  <div className="muted small">{fmtDate(s.date)}{s.note ? ` · Excused: ${s.note}` : ''}</div>
                </div>
                {s.excused ? <Pill tone="ok">Excused</Pill> : <button className="btn ghost sm" onClick={() => setExcuse(s.id)}>Excuse</button>}
              </div>
            ))}
          </div>

          <div className="card flush">
            <div className="card-head"><h3>Recent work history</h3></div>
            {history.length === 0 ? <Empty title="No applications yet" /> : history.map((a) => {
              const r = requirement(a.reqId);
              return (
                <div key={a.id} className="list-row">
                  <div className="grow">
                    <b>{r?.title}</b>
                    <div className="muted small">{r?.venue} · {r && fmtDate(r.date)}</div>
                  </div>
                  <AppPill s={a.status} />
                </div>
              );
            })}
          </div>
        </Drawer>
      )}

      {w && change && (
        <PromptModal
          title={`${change === 'active' ? 'Reinstate' : titleCase(change === 'banned' ? 'ban' : change.replace(/ed$/, ''))} ${w.name}?`}
          body={STATUS_HELP[change]}
          label="Note for the audit log"
          placeholder="Why is this change being made?"
          confirm="Confirm"
          danger={change !== 'active'}
          required
          multiline
          onClose={() => setChange(null)}
          onSubmit={(note) => setWorkerStatus(w.id, change, note)}
        />
      )}
      {w && excuse && (
        <PromptModal
          title="Excuse this strike?"
          body="Use this for genuine emergencies. The strike stays on record but stops counting against the worker."
          label="Note"
          placeholder="e.g. Medical emergency, hospital slip shared"
          confirm="Excuse strike"
          required
          multiline
          onClose={() => setExcuse(null)}
          onSubmit={(note) => excuseStrike(w.id, excuse, note)}
        />
      )}
    </>
  );
}
