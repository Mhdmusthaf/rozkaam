import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Zap } from 'lucide-react';
import { useStore } from '../data/store';
import { CATEGORIES } from '../data/seed';
import { dayOffset, fmtDate, inr, titleCase } from '../data/format';
import type { ReqStatus } from '../data/types';
import { Empty, PageHead, Pill, ReqPill } from '../ui';

const STATUSES: ReqStatus[] = ['awaiting_funding', 'open', 'filled', 'in_progress', 'completed', 'cancelled'];

export default function Requirements() {
  const { db, business, filled } = useStore();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const [category, setCategory] = useState('all');
  const [when, setWhen] = useState('all');
  const [q, setQ] = useState('');

  const rows = db.requirements
    .filter((r) => status === 'all' || r.status === status)
    .filter((r) => category === 'all' || r.category === category)
    .filter((r) => {
      const off = dayOffset(r.date);
      if (when === 'today') return off === 0;
      if (when === 'upcoming') return off > 0;
      if (when === 'week') return off <= 0 && off >= -7;
      if (when === 'past') return off < 0;
      return true;
    })
    .filter((r) => {
      const t = q.trim().toLowerCase();
      return !t || `${r.id} ${r.title} ${business(r.businessId).name} ${r.venue}`.toLowerCase().includes(t);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHead title="Requirements" sub="Every workforce requirement posted by a business, with its roster, attendance and money." />
      <div className="card flush">
        <div className="card-head">
          <div className="filters grow">
            <div className="search">
              <Search size={15} />
              <input className="input" placeholder="Search by ID, title or business" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" value={status} aria-label="Status" onChange={(e) => setParams(e.target.value === 'all' ? {} : { status: e.target.value })}>
              <option value="all">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
            <select className="input" value={category} aria-label="Category" onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input" value={when} aria-label="Date" onChange={(e) => setWhen(e.target.value)}>
              <option value="all">Any date</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="week">Last 7 days</option>
              <option value="past">All past</option>
            </select>
          </div>
          <span className="muted small num">{rows.length} of {db.requirements.length}</span>
        </div>
        {rows.length === 0 ? <Empty title="No requirements match">Try clearing a filter.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Requirement</th><th>Business</th><th>Date</th><th>Workers</th><th className="right">Pay / worker</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => nav(`/requirements/${r.id}`)}>
                    <td className="num muted nowrap">{r.id}</td>
                    <td>
                      <b>{r.title}</b> {r.urgent && <Pill tone="bad"><Zap size={11} /> Urgent</Pill>}
                      <div className="muted small">{r.category}</div>
                    </td>
                    <td>{business(r.businessId).name}</td>
                    <td className="nowrap">{fmtDate(r.date)}<div className="muted small">{r.startTime} – {r.endTime}</div></td>
                    <td className="num">{filled(r.id)}/{r.workersNeeded}</td>
                    <td className="right num">{inr(r.pay)}</td>
                    <td><ReqPill s={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
