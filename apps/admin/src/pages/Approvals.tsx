import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, ExternalLink, MapPin, Repeat, X, Zap } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDate, inr } from '../data/format';
import type { Application } from '../data/types';
import { AppPill, Empty, Meter, Modal, PageHead, Person, Pill, Rating, ReqPill } from '../ui';

export default function Approvals() {
  const { db, worker, business, appsFor, filled, setApplication, bulkApprove, replace, can } = useStore();
  const { id } = useParams();
  const nav = useNavigate();
  const [scope, setScope] = useState<'open' | 'filled'>('open');
  const [bulk, setBulk] = useState(3);
  const [swap, setSwap] = useState<Application | null>(null);

  const list = db.requirements
    .filter((r) => r.status === scope)
    .sort((a, b) => a.date.localeCompare(b.date));
  const current = db.requirements.find((r) => r.id === id) ?? list[0];
  const apps = current ? appsFor(current.id) : [];
  const score = (a: Application) => worker(a.workerId).reliability + worker(a.workerId).rating * 4;
  const pending = apps.filter((a) => a.status === 'applied').sort((a, b) => score(b) - score(a));
  const confirmed = apps.filter((a) => a.status === 'approved');
  const waitlist = apps.filter((a) => a.status === 'waitlisted').sort((a, b) => score(b) - score(a));
  const rejected = apps.filter((a) => a.status === 'rejected' || a.status === 'withdrawn');
  const slots = current ? filled(current.id) : 0;
  const room = current ? Math.max(0, current.workersNeeded - slots) : 0;

  const row = (a: Application, actions: React.ReactNode) => {
    const w = worker(a.workerId);
    const live = w.strikes.filter((s) => !s.excused).length;
    return (
      <tr key={a.id}>
        <td><Person name={w.name} sub={`${w.area} · ${w.experience}`} /></td>
        <td><Rating value={w.rating} count={w.ratingCount} /></td>
        <td className="num">{w.jobsDone}</td>
        <td><Meter value={w.reliability} /></td>
        <td>{live ? <Pill tone={live > 1 ? 'bad' : 'warn'}>{live} strike{live > 1 ? 's' : ''}</Pill> : <span className="muted">None</span>}</td>
        <td className="num nowrap">{a.distanceKm < 0 ? <span className="muted" title="Not available from the server yet">—</span> : `${a.distanceKm} km`}</td>
        <td style={{ maxWidth: 220 }}>{w.skills.map((s) => <span key={s} className="chip">{s}</span>)}</td>
        <td className="right"><div className="row gap-6" style={{ justifyContent: 'flex-end' }}>{actions}</div></td>
      </tr>
    );
  };
  const head = (
    <thead>
      <tr><th>Worker</th><th>Rating</th><th>Jobs</th><th>Reliability</th><th>Strikes</th><th>Distance</th><th>Skills</th><th className="right">Action</th></tr>
    </thead>
  );

  return (
    <>
      <PageHead title="Applicant approval" sub="The ops team confirms who works each requirement. Businesses see the confirmed roster but do not pick.">
        <div className="seg">
          <button className={scope === 'open' ? 'on' : ''} onClick={() => { setScope('open'); nav('/approvals'); }}>Open</button>
          <button className={scope === 'filled' ? 'on' : ''} onClick={() => { setScope('filled'); nav('/approvals'); }}>Filled</button>
        </div>
      </PageHead>

      {!current ? (
        <div className="card"><Empty title={`No ${scope} requirements`}>Nothing is waiting on the ops team right now.</Empty></div>
      ) : (
        <div className="split">
          <div className="col">
            {list.map((r) => {
              const n = filled(r.id);
              const waiting = appsFor(r.id).filter((a) => a.status === 'applied').length;
              return (
                <button key={r.id} className={`pick ${r.id === current.id ? 'on' : ''}`} onClick={() => nav(`/approvals/${r.id}`)}>
                  <div className="row between">
                    <span className="muted small num">{r.id}</span>
                    {r.urgent && <Pill tone="bad"><Zap size={11} /> Urgent</Pill>}
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{r.title}</div>
                  <div className="muted small">{business(r.businessId).name} · {fmtDate(r.date)}, {r.startTime}</div>
                  <div className="row gap-6 mt-8">
                    <div className="meter grow"><i style={{ width: `${Math.min(100, (n / r.workersNeeded) * 100)}%` }} /></div>
                    <b className="num small">{n}/{r.workersNeeded}</b>
                  </div>
                  <div className="muted small mt-4">{waiting} waiting for a decision</div>
                </button>
              );
            })}
            {list.length === 0 && <div className="card"><Empty title={`No ${scope} requirements`} /></div>}
          </div>

          <div className="col gap-16">
            <div className="card">
              <div className="row between wrap">
                <div>
                  <div className="row gap-6"><h2>{current.title}</h2><ReqPill s={current.status} /></div>
                  <div className="muted small mt-4 row gap-6 wrap">
                    <span className="row gap-4"><MapPin size={13} />{current.venue}</span>
                    <span className="row gap-4"><Clock size={13} />{fmtDate(current.date)} · report {current.reportTime}</span>
                    <span>{inr(current.pay)} per worker</span>
                  </div>
                </div>
                <Link to={`/requirements/${current.id}`} className="btn ghost sm"><ExternalLink size={14} /> Full details</Link>
              </div>
              <div className="row between wrap mt-16" style={{ background: 'var(--violet-tint)', borderRadius: 12, padding: 12 }}>
                <div>
                  <b className="num" style={{ fontSize: 20 }}>{slots}/{current.workersNeeded}</b> <span className="muted">slots confirmed</span>
                  <div className="muted small">{room ? `${room} still to fill · ${pending.length} applicants waiting` : 'Fully staffed. Extra applicants can go on the waitlist.'}</div>
                </div>
                <div className="row gap-6">
                  <span className="muted small">Approve top</span>
                  <input className="input num" type="number" min={1} max={Math.max(1, room)} value={bulk} onChange={(e) => setBulk(Math.max(1, Number(e.target.value) || 1))} style={{ width: 64 }} />
                  <button className="btn" disabled={!room || !(pending.length + waitlist.length)} onClick={() => bulkApprove(current.id, bulk)}>
                    <Zap size={14} /> Bulk approve
                  </button>
                </div>
              </div>
            </div>

            <div className="card flush">
              <div className="card-head"><h2>Applicants waiting ({pending.length})</h2><span className="muted small">Ranked by reliability and rating</span></div>
              {pending.length === 0 ? <Empty title="No applicants waiting">New applications appear here as workers apply.</Empty> : (
                <div className="table-wrap"><table>{head}<tbody>
                  {pending.map((a) => row(a, <>
                    <button className="btn sm ok" disabled={!room} onClick={() => setApplication(a.id, 'approved')}><Check size={13} /> Approve</button>
                    <button className="btn sm ghost" onClick={() => setApplication(a.id, 'waitlisted')}>Waitlist</button>
                    <button className="btn sm danger" onClick={() => setApplication(a.id, 'rejected')} aria-label="Reject"><X size={13} /></button>
                  </>))}
                </tbody></table></div>
              )}
            </div>

            <div className="card flush">
              <div className="card-head"><h2>Confirmed ({confirmed.length})</h2></div>
              {confirmed.length === 0 ? <Empty title="Nobody confirmed yet" /> : (
                <div className="table-wrap"><table>{head}<tbody>
                  {confirmed.map((a) => row(a, <>
                    <AppPill s={a.status} />
                    {can.replaceWorker ? <button className="btn sm ghost" onClick={() => setSwap(a)}><Repeat size={13} /> Replace</button> : <span className="muted small" title="Replacing a confirmed worker is not available from the server yet">Confirmed</span>}
                  </>))}
                </tbody></table></div>
              )}
            </div>

            <div className="card flush">
              <div className="card-head"><h2>Waitlist ({waitlist.length})</h2><span className="muted small">First in line if someone cancels</span></div>
              {waitlist.length === 0 ? <Empty title="Waitlist is empty" /> : (
                <div className="table-wrap"><table>{head}<tbody>
                  {waitlist.map((a) => row(a, <>
                    <button className="btn sm ok" disabled={!room} onClick={() => setApplication(a.id, 'approved')}><Check size={13} /> Approve</button>
                    <button className="btn sm danger" onClick={() => setApplication(a.id, 'rejected')} aria-label="Reject"><X size={13} /></button>
                  </>))}
                </tbody></table></div>
              )}
            </div>

            {rejected.length > 0 && (
              <div className="card flush">
                <div className="card-head"><h2>Rejected or replaced ({rejected.length})</h2></div>
                <div className="table-wrap"><table>{head}<tbody>
                  {rejected.map((a) => row(a, <>
                    <AppPill s={a.status} />
                    <button className="btn sm ghost" onClick={() => setApplication(a.id, 'waitlisted')}>Move to waitlist</button>
                  </>))}
                </tbody></table></div>
              </div>
            )}
          </div>
        </div>
      )}

      {swap && current && (
        <Modal title={`Replace ${worker(swap.workerId).name}`} onClose={() => setSwap(null)}>
          <p className="muted mt-8">Pick who takes this slot. The replaced worker is removed from the roster for {current.id}.</p>
          <div className="col gap-6 mt-16" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {[...waitlist, ...pending].length === 0 && <Empty title="Nobody available">There is no one on the waitlist or waiting to be approved.</Empty>}
            {[...waitlist, ...pending].map((a) => {
              const w = worker(a.workerId);
              return (
                <button key={a.id} className="pick" style={{ boxShadow: 'none', border: '1px solid var(--line)' }} onClick={() => { replace(swap.id, a.id); setSwap(null); }}>
                  <div className="row between">
                    <Person name={w.name} sub={`${a.status === 'waitlisted' ? 'Waitlist' : 'Applied'}${a.distanceKm < 0 ? '' : ` · ${a.distanceKm} km`} · reliability ${w.reliability}`} />
                    <Rating value={w.rating} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="modal-actions"><button className="btn ghost" onClick={() => setSwap(null)}>Cancel</button></div>
        </Modal>
      )}
    </>
  );
}
