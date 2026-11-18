import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDate, inr, titleCase } from '../data/format';
import type { AccountStatus } from '../data/types';
import { AccountPill, Drawer, Empty, KycPill, PageHead, Person, PromptModal, Rating, ReqPill } from '../ui';
import { STATUS_HELP, StatusActions } from './Workers';

export default function Businesses() {
  const { db, setBusinessStatus } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [change, setChange] = useState<AccountStatus | null>(null);

  const reqsOf = (id: string) => db.requirements.filter((r) => r.businessId === id);
  const sumOf = (id: string, type: string) => db.ledger.filter((l) => l.businessId === id && l.type === type).reduce((n, l) => n + l.amount, 0);
  const rows = db.businesses
    .filter((b) => status === 'all' || b.status === status)
    .filter((b) => !q.trim() || `${b.id} ${b.name} ${b.category} ${b.area} ${b.contactName}`.toLowerCase().includes(q.trim().toLowerCase()));
  const b = db.businesses.find((x) => x.id === openId);

  return (
    <>
      <PageHead title="Businesses" sub="Companies registered to post workforce requirements." />
      <div className="card flush">
        <div className="card-head">
          <div className="filters grow">
            <div className="search">
              <Search size={15} />
              <input className="input" placeholder="Search name, category, area or contact" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" aria-label="Account status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All account states</option>
              {['active', 'restricted', 'suspended', 'banned'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </div>
          <span className="muted small num">{rows.length} businesses</span>
        </div>
        {rows.length === 0 ? <Empty title="No businesses match" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Business</th><th>Category</th><th>Area</th><th>Rating</th><th>Requirements</th><th className="right">Funded</th><th>KYC</th><th>Account</th></tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="click" onClick={() => setOpenId(x.id)}>
                    <td><Person square name={x.name} sub={`${x.id} · ${x.contactName}`} /></td>
                    <td>{x.category}</td>
                    <td>{x.area}</td>
                    <td><Rating value={x.rating} count={x.ratingCount} /></td>
                    <td className="num">{reqsOf(x.id).length}</td>
                    <td className="right num">{inr(sumOf(x.id, 'funding'))}</td>
                    <td><KycPill s={x.kyc} /></td>
                    <td><AccountPill s={x.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {b && (
        <Drawer title="Business profile" onClose={() => setOpenId(null)}>
          <div className="card">
            <div className="row">
              <div className="avatar lg sq">{b.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}</div>
              <div className="grow">
                <h2 style={{ fontSize: 18 }}>{b.name}</h2>
                <div className="muted small">{b.id} · joined {fmtDate(b.joined)}</div>
                <div className="row gap-6 mt-8"><AccountPill s={b.status} /><KycPill s={b.kyc} /></div>
              </div>
            </div>
            <div className="grid mt-16" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div><div className="muted small">Rating by workers</div><Rating value={b.rating} count={b.ratingCount} /></div>
              <div><div className="muted small">Funded</div><b className="num">{inr(sumOf(b.id, 'funding'))}</b></div>
              <div><div className="muted small">Refunded</div><b className="num">{inr(sumOf(b.id, 'refund'))}</b></div>
            </div>
          </div>

          <div className="card">
            <h3>Account actions</h3>
            <p className="muted small mt-4">Every change needs a note and is written to the audit log.</p>
            <div className="mt-16"><StatusActions status={b.status} onPick={setChange} /></div>
          </div>

          <div className="card">
            <h3>Company</h3>
            <dl className="dl mt-16">
              <dt>Category</dt><dd>{b.category}</dd>
              <dt>GSTIN</dt><dd className="num">{b.gstin}</dd>
              <dt>Address</dt><dd style={{ fontWeight: 500 }}>{b.address}</dd>
              <dt>Contact person</dt><dd>{b.contactName}</dd>
              <dt>Phone</dt><dd className="num">{b.contactPhone}</dd>
              <dt>Email</dt><dd>{b.email}</dd>
              <dt>Documents</dt><dd>{b.docs.map((d) => <span key={d} className="chip">{d}</span>)}</dd>
            </dl>
          </div>

          <div className="card flush">
            <div className="card-head"><h3>Requirements ({reqsOf(b.id).length})</h3></div>
            {reqsOf(b.id).length === 0 ? <Empty title="No requirements posted yet" /> : reqsOf(b.id).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 8).map((r) => (
              <Link key={r.id} to={`/requirements/${r.id}`} className="list-row">
                <div className="grow">
                  <b>{r.title}</b>
                  <div className="muted small">{r.id} · {fmtDate(r.date)} · {r.workersNeeded} workers × {inr(r.pay)}</div>
                </div>
                <ReqPill s={r.status} />
              </Link>
            ))}
          </div>
        </Drawer>
      )}

      {b && change && (
        <PromptModal
          title={`${change === 'active' ? 'Reinstate' : titleCase(change === 'banned' ? 'ban' : change.replace(/ed$/, ''))} ${b.name}?`}
          body={STATUS_HELP[change]}
          label="Note for the audit log"
          placeholder="Why is this change being made?"
          confirm="Confirm"
          danger={change !== 'active'}
          required
          multiline
          onClose={() => setChange(null)}
          onSubmit={(note) => setBusinessStatus(b.id, change, note)}
        />
      )}
    </>
  );
}
