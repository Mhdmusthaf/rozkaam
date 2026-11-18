import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, Building2, ClipboardList, HandCoins, Percent, TrendingUp, UserX, Users } from 'lucide-react';
import { useMetrics, useStore } from '../data/store';
import { inr, inrShort, titleCase } from '../data/format';
import type { ReqStatus } from '../data/types';
import { Kpi, PageHead } from '../ui';
import { useQueueCounts } from '../Layout';

const STATUS_COLOR: Record<ReqStatus, string> = {
  awaiting_funding: '#d97706', open: '#6601f9', filled: '#1d4ed8', in_progress: '#0f8a45', completed: '#b1c2cc', cancelled: '#d1343a',
};

function BarChart({ data }: { data: { label: string; gmv: number }[] }) {
  const W = 640, H = 240, pad = { l: 8, r: 8, t: 26, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.gmv));
  const bw = (W - pad.l - pad.r) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="GMV by week for the last eight weeks">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * (1 - f)} y2={pad.t + (H - pad.t - pad.b) * (1 - f)} stroke="#eceaf3" />
      ))}
      {data.map((d, i) => {
        const h = ((H - pad.t - pad.b) * d.gmv) / max;
        const x = pad.l + i * bw + bw * 0.18;
        const y = H - pad.b - h;
        const last = i === data.length - 1;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw * 0.64} height={Math.max(2, h)} rx={8} fill={last ? '#6601f9' : '#cdb4ff'}>
              <title>{`${d.label}: ${inr(d.gmv)} GMV`}</title>
            </rect>
            <text x={x + bw * 0.32} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="#14111f">{inrShort(d.gmv)}</text>
            <text x={x + bw * 0.32} y={H - 9} textAnchor="middle" fontSize="11" fill="#6b6880">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const { db } = useStore();
  const m = useMetrics();
  const q = useQueueCounts();
  const statuses: ReqStatus[] = ['open', 'filled', 'in_progress', 'awaiting_funding', 'completed', 'cancelled'];
  const counts = statuses.map((s) => ({ s, n: db.requirements.filter((r) => r.status === s).length }));
  const total = db.requirements.length;
  const attention = [
    { to: '/approvals', n: q.approvals, label: 'open requirements need applicants approved', color: '#6601f9' },
    { to: '/flags', n: q.flags, label: 'flagged check-ins to review', color: '#d1343a' },
    { to: '/kyc/workers', n: q.workerKyc, label: 'worker KYC submissions waiting', color: '#d97706' },
    { to: '/kyc/businesses', n: q.businessKyc, label: 'business KYC submissions waiting', color: '#d97706' },
    { to: '/withdrawals', n: q.withdrawals, label: 'withdrawal requests to pay out', color: '#0f8a45' },
  ].filter((a) => a.n > 0);

  return (
    <>
      <PageHead title="Dashboard" sub="All figures come from the demo ledger. GMV, worker payouts and Rozkaam revenue are tracked separately." />
      <div className="grid kpis">
        <Kpi accent label="GMV (work value)" value={inrShort(m.gmv)} hint="Total value of completed work. Not revenue." icon={<TrendingUp size={16} />} />
        <Kpi label="Rozkaam revenue" value={inrShort(m.revenue)} hint="Commission earned on completed work" icon={<Percent size={16} />} />
        <Kpi label="Worker payouts" value={inrShort(m.payouts)} hint="Released to worker wallets" icon={<HandCoins size={16} />} />
        <Kpi label="Requirements" value={m.requirements} hint={`${counts[0].n} open · ${counts[2].n} in progress`} icon={<ClipboardList size={16} />} />
        <Kpi label="Fill rate" value={`${m.fillRate}%`} hint="Slots worked ÷ slots requested (completed)" icon={<Banknote size={16} />} />
        <Kpi label="No-show rate" value={`${m.noShowRate}%`} hint="Confirmed workers who did not turn up" icon={<UserX size={16} />} />
        <Kpi label="Active workers" value={m.activeWorkers} hint="Paid for at least one job in 30 days" icon={<Users size={16} />} />
        <Kpi label="Active businesses" value={m.activeBusinesses} hint="Funded a requirement in 30 days" icon={<Building2 size={16} />} />
      </div>

      <div className="grid two mt-16">
        <div className="card">
          <h2>GMV by week</h2>
          <p className="muted small">Value of work completed, last eight weeks</p>
          <div className="mt-16"><BarChart data={m.weeks} /></div>
        </div>
        <div className="card">
          <h2>Requirements by status</h2>
          <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginTop: 16, gap: 2 }}>
            {counts.filter((c) => c.n).map((c) => (
              <div key={c.s} title={`${titleCase(c.s)}: ${c.n}`} style={{ width: `${(c.n / total) * 100}%`, background: STATUS_COLOR[c.s] }} />
            ))}
          </div>
          <div className="col gap-6 mt-16">
            {counts.map((c) => (
              <Link key={c.s} to={`/requirements?status=${c.s}`} className="row between" style={{ padding: '4px 0' }}>
                <span className="row gap-6"><span className="dot" style={{ background: STATUS_COLOR[c.s] }} />{titleCase(c.s)}</span>
                <b className="num">{c.n}</b>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card flush mt-16">
        <div className="card-head"><h2>Needs attention</h2><span className="muted small">Queues the ops team should clear today</span></div>
        {attention.length === 0 && <div className="empty"><strong>All clear</strong>Every queue is empty.</div>}
        {attention.map((a) => (
          <Link key={a.to} to={a.to} className="list-row">
            <span className="dot" style={{ background: a.color }} />
            <span className="grow"><b className="num">{a.n}</b> {a.label}</span>
            <ArrowRight size={16} className="muted" />
          </Link>
        ))}
      </div>
    </>
  );
}
