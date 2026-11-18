import { useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDateTime } from '../data/format';
import { Empty, PageHead } from '../ui';

export default function Audit() {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const rows = db.audit.filter((a) => !q.trim() || `${a.action} ${a.target} ${a.detail ?? ''} ${a.actor}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <PageHead title="Audit log" sub="Every action taken in this panel, newest first. Entries cannot be edited or deleted." />
      <div className="card flush">
        <div className="card-head">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Search actions, people or notes" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <span className="muted small num">{rows.length} entries</span>
        </div>
        {rows.length === 0 ? <Empty title="No entries match" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Note</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap num">{fmtDateTime(a.time)}</td>
                    <td className="nowrap">{a.actor}</td>
                    <td><b>{a.action}</b></td>
                    <td>{a.target}</td>
                    <td className="muted">{a.detail ?? '—'}</td>
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
