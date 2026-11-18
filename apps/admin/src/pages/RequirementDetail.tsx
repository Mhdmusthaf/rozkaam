import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Camera, CameraOff, UserCheck, Zap } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDate, fmtDateTime, fmtTime, inr, split } from '../data/format';
import { AppPill, Empty, PageHead, Person, Pill, PromptModal, Rating, ReqPill } from '../ui';

export default function RequirementDetail() {
  const { id } = useParams();
  const { db, requirement, business, worker, appsFor, filled, cancelRequirement } = useStore();
  const [cancel, setCancel] = useState(false);
  const r = requirement(id ?? '');
  if (!r) return <div className="card"><Empty title="Requirement not found"><Link to="/requirements" className="btn ghost mt-16">Back to requirements</Link></Empty></div>;

  const biz = business(r.businessId);
  const apps = appsFor(r.id);
  const roster = apps.filter((a) => !['applied', 'rejected', 'withdrawn'].includes(a.status));
  const sp = split(r.pay, r.commissionRate, r.commissionMode);
  const paid = apps.filter((a) => a.status === 'paid').length;
  const entries = db.ledger.filter((l) => l.reqId === r.id);
  const total = (t: string) => entries.filter((l) => l.type === t).reduce((n, l) => n + l.amount, 0);
  const canCancel = ['awaiting_funding', 'open', 'filled'].includes(r.status);
  const events = [
    { t: r.createdAt, label: 'Requirement posted', on: true },
    { t: r.createdAt, label: r.funded ? `Funded by ${biz.name}` : 'Waiting for the business to fund', on: r.funded },
    ...roster.filter((a) => a.checkIn).sort((a, b) => a.checkIn!.time.localeCompare(b.checkIn!.time)).map((a) => ({
      t: a.checkIn!.time,
      label: `${worker(a.workerId).name} checked in · ${a.checkIn!.distanceM} m from venue${a.checkIn!.flag ? ' (flagged)' : ''}`,
      on: true,
    })),
    ...roster.filter((a) => a.checkOut).slice(0, 1).map((a) => ({ t: a.checkOut!.time, label: `Check-out completed (${roster.filter((x) => x.checkOut).length} workers)`, on: true })),
    ...(r.status === 'completed' ? [{ t: entries.find((l) => l.type === 'commission')?.date ?? r.date, label: `Attendance approved · ${paid} workers paid`, on: true }] : []),
    ...(r.status === 'cancelled' ? [{ t: entries.find((l) => l.type === 'refund')?.date ?? r.date, label: `Cancelled: ${r.cancelReason ?? 'no reason given'}`, on: true }] : []),
  ];

  return (
    <>
      <Link to="/requirements" className="row gap-6 muted small" style={{ marginBottom: 10 }}><ArrowLeft size={14} /> Requirements</Link>
      <PageHead title={r.title} sub={`${r.id} · ${biz.name} · posted ${fmtDateTime(r.createdAt)}`}>
        <ReqPill s={r.status} />
        {r.urgent && <Pill tone="bad"><Zap size={11} /> Urgent</Pill>}
        {(r.status === 'open' || r.status === 'filled') && <Link to={`/approvals/${r.id}`} className="btn"><UserCheck size={15} /> Manage applicants</Link>}
        {canCancel && <button className="btn danger" onClick={() => setCancel(true)}><Ban size={15} /> Cancel requirement</button>}
      </PageHead>

      <div className="grid two">
        <div className="col gap-16">
          <div className="card">
            <h2>Details</h2>
            <dl className="dl mt-16">
              <dt>Category</dt><dd>{r.category}</dd>
              <dt>Description</dt><dd style={{ fontWeight: 500 }}>{r.description}</dd>
              <dt>Workers needed</dt><dd className="num">{r.workersNeeded} ({filled(r.id)} confirmed)</dd>
              <dt>Venue</dt><dd>{r.venue}</dd>
              <dt>Address</dt><dd style={{ fontWeight: 500 }}>{r.address}</dd>
              <dt>Date</dt><dd>{fmtDate(r.date)}</dd>
              <dt>Report / start / end</dt><dd className="num">{r.reportTime} · {r.startTime} · {r.endTime}</dd>
              <dt>Pay per worker</dt><dd className="num">{inr(r.pay)}</dd>
              <dt>Dress code</dt><dd>{r.dressCode}</dd>
              <dt>Gender</dt><dd>{r.gender}</dd>
              <dt>Height / attributes</dt><dd>{r.attributes}</dd>
              <dt>Skills</dt><dd>{r.skills.map((s) => <span key={s} className="chip">{s}</span>)}</dd>
              <dt>Instructions</dt><dd style={{ fontWeight: 500 }}>{r.instructions}</dd>
              <dt>Point of contact</dt><dd>{r.pocName} · <span className="num">{r.pocPhone}</span></dd>
            </dl>
          </div>

          <div className="card flush">
            <div className="card-head"><h2>Roster ({roster.length})</h2><span className="muted small">{apps.filter((a) => a.status === 'applied').length} more applied and waiting</span></div>
            {roster.length === 0 ? <Empty title="No one on the roster yet">Approve applicants to build the roster.</Empty> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Worker</th><th>Rating</th><th>Check-in</th><th>Check-out</th><th>Photo</th><th>Status</th></tr></thead>
                  <tbody>
                    {roster.map((a) => {
                      const w = worker(a.workerId);
                      return (
                        <tr key={a.id}>
                          <td><Person name={w.name} sub={w.area} /></td>
                          <td><Rating value={w.rating} /></td>
                          <td className="num nowrap">
                            {a.checkIn ? <>{fmtTime(a.checkIn.time)}<div className={`small ${a.checkIn.flag === 'distance' ? '' : 'muted'}`} style={a.checkIn.flag === 'distance' ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>{a.checkIn.distanceM} m away</div></> : <span className="muted">—</span>}
                          </td>
                          <td className="num nowrap">{a.checkOut ? fmtTime(a.checkOut.time) : <span className="muted">—</span>}</td>
                          <td>{a.checkIn ? (a.checkIn.photo ? <Camera size={16} color="#0f8a45" aria-label="Photo captured" /> : <CameraOff size={16} color="#d1343a" aria-label="No photo" />) : <span className="muted">—</span>}</td>
                          <td><AppPill s={a.status} />{a.checkIn?.flag && !a.checkIn.resolved && <> <Pill tone="bad">Flagged</Pill></>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col gap-16">
          <div className="card">
            <h2>Money</h2>
            <p className="muted small mt-4">Commission {r.commissionRate}% · {r.commissionMode === 'on_top' ? 'added on top for the business' : 'deducted from worker pay'} (locked when posted)</p>
            <dl className="dl mt-16" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>Business pays per worker</dt><dd className="num right">{inr(sp.businessPays)}</dd>
              <dt>Worker receives</dt><dd className="num right">{inr(sp.workerGets)}</dd>
              <dt>Rozkaam commission per worker</dt><dd className="num right">{inr(sp.fee)}</dd>
            </dl>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />
            <dl className="dl" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>Funded by business</dt><dd className="num right">{r.funded ? inr(total('funding')) : 'Not funded'}</dd>
              <dt>GMV (work value completed)</dt><dd className="num right">{inr(paid * r.pay)}</dd>
              <dt>Worker payouts released</dt><dd className="num right">{inr(total('payout'))}</dd>
              <dt>Rozkaam revenue (commission)</dt><dd className="num right">{inr(total('commission'))}</dd>
              <dt>Refunded to business</dt><dd className="num right">{inr(total('refund'))}</dd>
            </dl>
          </div>

          <div className="card">
            <h2>Timeline</h2>
            <ul className="timeline mt-16">
              {events.map((e, i) => (
                <li key={i} className={e.on ? '' : 'off'}>
                  <div style={{ fontWeight: 600 }}>{e.label}</div>
                  <div className="muted small">{fmtDateTime(e.t)}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>Business</h2>
            <div className="mt-16"><Person square name={biz.name} sub={`${biz.category} · ${biz.area}`} /></div>
            <dl className="dl mt-16">
              <dt>Contact</dt><dd>{biz.contactName}</dd>
              <dt>Phone</dt><dd className="num">{biz.contactPhone}</dd>
              <dt>Rating</dt><dd><Rating value={biz.rating} count={biz.ratingCount} /></dd>
            </dl>
          </div>
        </div>
      </div>

      {cancel && (
        <PromptModal
          title={`Cancel ${r.id}?`}
          body={r.funded ? `The business is refunded ${inr(sp.businessPays * r.workersNeeded)} and every applicant is released.` : 'Every applicant is released. Nothing was funded, so there is nothing to refund.'}
          label="Reason (shared with the business and workers)"
          placeholder="e.g. Event postponed by the client"
          confirm="Cancel requirement"
          danger
          required
          multiline
          onClose={() => setCancel(false)}
          onSubmit={(reason) => cancelRequirement(r.id, reason)}
        />
      )}
    </>
  );
}
