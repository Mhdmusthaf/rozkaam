import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CameraOff, Check, MapPinOff, UserX } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDateTime } from '../data/format';
import { Empty, PageHead, Person, Pill } from '../ui';

export default function Flags() {
  const { db, worker, requirement, business, resolveFlag } = useStore();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const all = db.applications.filter((a) => a.checkIn?.flag);
  const rows = all
    .filter((a) => (tab === 'open' ? !a.checkIn!.resolved : !!a.checkIn!.resolved))
    .sort((a, b) => b.checkIn!.time.localeCompare(a.checkIn!.time));
  const limit = db.settings.geofenceM;

  return (
    <>
      <PageHead title="Attendance flags" sub={`Check-ins more than ${limit} m from the venue, or without a photo, wait here for a decision.`}>
        <div className="seg">
          <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>To review ({all.filter((a) => !a.checkIn!.resolved).length})</button>
          <button className={tab === 'resolved' ? 'on' : ''} onClick={() => setTab('resolved')}>Resolved</button>
        </div>
      </PageHead>
      <div className="card flush">
        {rows.length === 0 ? <Empty title={tab === 'open' ? 'No flags to review' : 'Nothing resolved yet'}>Flagged check-ins appear here automatically.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Worker</th><th>Requirement</th><th>Checked in</th><th>Reason</th><th>Distance</th><th className="right">Decision</th></tr></thead>
              <tbody>
                {rows.map((a) => {
                  const w = worker(a.workerId);
                  const r = requirement(a.reqId)!;
                  const c = a.checkIn!;
                  return (
                    <tr key={a.id}>
                      <td><Person name={w.name} sub={`Reliability ${w.reliability} · ${w.strikes.filter((s) => !s.excused).length} strikes`} /></td>
                      <td><Link to={`/requirements/${r.id}`}><b>{r.title}</b></Link><div className="muted small">{r.id} · {business(r.businessId).name}</div></td>
                      <td className="nowrap num">{fmtDateTime(c.time)}</td>
                      <td>{c.flag === 'distance' ? <Pill tone="bad"><MapPinOff size={12} /> Outside geofence</Pill> : <Pill tone="warn"><CameraOff size={12} /> No photo</Pill>}</td>
                      <td className="num nowrap" style={c.distanceM > limit ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>{c.distanceM.toLocaleString('en-IN')} m</td>
                      <td className="right">
                        {c.resolved ? (
                          <Pill tone={c.resolved === 'accepted' ? 'ok' : 'bad'}>{c.resolved === 'accepted' ? 'Accepted' : 'No-show'}</Pill>
                        ) : (
                          <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn sm ok" onClick={() => resolveFlag(a.id, 'accepted')}><Check size={13} /> Accept</button>
                            <button className="btn sm danger" onClick={() => resolveFlag(a.id, 'no_show')}><UserX size={13} /> Mark no-show</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small mt-16">Marking a no-show adds a strike to the worker and lowers their reliability score. Strikes can be excused from the worker's profile.</p>
    </>
  );
}
