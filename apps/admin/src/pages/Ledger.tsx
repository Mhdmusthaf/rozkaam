import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, HandCoins, Percent, RotateCcw, Search, TrendingUp } from 'lucide-react';
import { useMetrics, useStore } from '../data/store';
import { fmtDateTime, inr, inrShort, titleCase } from '../data/format';
import type { LedgerType } from '../data/types';
import { Empty, Kpi, PageHead, Pill } from '../ui';

const TONE: Record<LedgerType, 'info' | 'ok' | 'violet' | 'warn'> = { funding: 'info', payout: 'ok', commission: 'violet', refund: 'warn' };
const HELP: Record<LedgerType, string> = {
  funding: 'Money in from a business',
  payout: 'Released to a worker wallet',
  commission: 'Rozkaam revenue',
  refund: 'Returned to a business',
};

export default function Ledger() {
  const { db, business, worker } = useStore();
  const m = useMetrics();
  const [type, setType] = useState('all');
  const [range, setRange] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(60);

  const since = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
  const rows = db.ledger
    .filter((l) => type === 'all' || l.type === type)
    .filter((l) => new Date(l.date).getTime() >= since)
    .filter((l) => {
      const t = q.trim().toLowerCase();
      if (!t) return true;
      const who = `${l.businessId ? business(l.businessId).name : ''} ${l.workerId ? worker(l.workerId).name : ''}`;
      return `${l.id} ${l.reqId} ${l.ref} ${who}`.toLowerCase().includes(t);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const shownTotal = rows.reduce((n, l) => n + l.amount, 0);

  return (
    <>
      <PageHead title="Ledger" sub="Every money movement on the platform. GMV is the value of completed work; it is shown apart from payouts and from Rozkaam revenue." />
      <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        <Kpi accent label="GMV (work value)" value={inrShort(m.gmv)} hint="Not revenue" icon={<TrendingUp size={16} />} />
        <Kpi label="Funding received" value={inrShort(m.funding)} hint="Paid in by businesses" icon={<ArrowDownLeft size={16} />} />
        <Kpi label="Worker payouts" value={inrShort(m.payouts)} hint="Released to wallets" icon={<HandCoins size={16} />} />
        <Kpi label="Rozkaam revenue" value={inrShort(m.revenue)} hint="Commission only" icon={<Percent size={16} />} />
        <Kpi label="Refunds" value={inrShort(m.refunds)} hint="Unused or cancelled slots" icon={<RotateCcw size={16} />} />
      </div>
      <style>{`@media (max-width: 1100px) { .kpis[style] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }`}</style>

      <div className="card flush mt-16">
        <div className="card-head">
          <div className="filters grow">
            <div className="search">
              <Search size={15} />
              <input className="input" placeholder="Search reference, requirement or name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" aria-label="Entry type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All entry types</option>
              {(['funding', 'payout', 'commission', 'refund'] as const).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
            <select className="input" aria-label="Period" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <span className="small"><span className="muted">{rows.length} entries · total </span><b className="num">{inr(shownTotal)}</b></span>
        </div>
        {rows.length === 0 ? <Empty title="No ledger entries match" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Requirement</th><th>Party</th><th>Reference</th><th className="right">Amount</th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap num">{fmtDateTime(l.date)}</td>
                    <td><Pill tone={TONE[l.type]}>{titleCase(l.type)}</Pill><div className="muted small">{HELP[l.type]}</div></td>
                    <td><Link to={`/requirements/${l.reqId}`} className="num" style={{ fontWeight: 700 }}>{l.reqId}</Link></td>
                    <td>{l.workerId ? worker(l.workerId).name : l.type === 'commission' ? 'Rozkaam' : l.businessId ? business(l.businessId).name : '—'}</td>
                    <td className="num muted">{l.ref}</td>
                    <td className="right num"><b>{inr(l.amount)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && (
          <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid var(--line)' }}>
            <button className="btn ghost" onClick={() => setLimit((n) => n + 100)}>Show more ({rows.length - limit} left)</button>
          </div>
        )}
      </div>
    </>
  );
}
