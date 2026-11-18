import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDateTime, inr, titleCase } from '../data/format';
import { Empty, Kpi, PageHead, Person, Pill, PromptModal } from '../ui';
import { Clock, HandCoins } from 'lucide-react';

export default function Withdrawals() {
  const { db, worker, payWithdrawal, rejectWithdrawal } = useStore();
  const [tab, setTab] = useState<'requested' | 'paid' | 'rejected'>('requested');
  const [pay, setPay] = useState<string | null>(null);
  const [reject, setReject] = useState<string | null>(null);
  const rows = db.withdrawals.filter((w) => w.status === tab).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const sum = (s: string) => db.withdrawals.filter((w) => w.status === s).reduce((n, w) => n + w.amount, 0);
  const target = db.withdrawals.find((w) => w.id === (pay ?? reject));

  return (
    <>
      <PageHead title="Withdrawals" sub="Workers ask to move wallet money to their UPI. In the sandbox the ops team sends the money and records the reference here." />
      <div className="grid halves">
        <Kpi label="Waiting to be paid" value={inr(sum('requested'))} hint={`${db.withdrawals.filter((w) => w.status === 'requested').length} requests`} icon={<Clock size={16} />} />
        <Kpi label="Paid out" value={inr(sum('paid'))} hint={`${db.withdrawals.filter((w) => w.status === 'paid').length} transfers recorded`} icon={<HandCoins size={16} />} />
      </div>
      <div className="card flush mt-16">
        <div className="card-head">
          <div className="seg">
            {(['requested', 'paid', 'rejected'] as const).map((s) => (
              <button key={s} className={tab === s ? 'on' : ''} onClick={() => setTab(s)}>{titleCase(s)} ({db.withdrawals.filter((w) => w.status === s).length})</button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? <Empty title={`No ${tab} withdrawals`} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Request</th><th>Worker</th><th>UPI ID</th><th>Requested</th><th className="right">Amount</th><th className="right">{tab === 'requested' ? 'Action' : tab === 'paid' ? 'Reference' : 'Reason'}</th></tr></thead>
              <tbody>
                {rows.map((w) => {
                  const p = worker(w.workerId);
                  return (
                    <tr key={w.id}>
                      <td className="num muted">{w.id}</td>
                      <td><Person name={p.name} sub={p.phone} /></td>
                      <td className="num">{w.upi}</td>
                      <td className="nowrap num">{fmtDateTime(w.requestedAt)}</td>
                      <td className="right num"><b>{inr(w.amount)}</b></td>
                      <td className="right">
                        {w.status === 'requested' ? (
                          <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn sm ok" onClick={() => setPay(w.id)}><Check size={13} /> Mark paid</button>
                            <button className="btn sm danger" onClick={() => setReject(w.id)}><X size={13} /> Reject</button>
                          </div>
                        ) : w.status === 'paid' ? <Pill tone="ok">{w.ref}</Pill> : <span className="muted small">{w.note}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pay && target && (
        <PromptModal
          title={`Mark ${inr(target.amount)} as paid?`}
          body={`Send the money to ${target.upi} first, then record the transfer reference.`}
          label="Transfer reference"
          placeholder="e.g. UPI428900123"
          confirm="Mark paid"
          required
          onClose={() => setPay(null)}
          onSubmit={(ref) => payWithdrawal(pay, ref)}
        />
      )}
      {reject && target && (
        <PromptModal
          title="Reject this withdrawal?"
          body={`${inr(target.amount)} goes back to the worker's wallet and they are told why.`}
          label="Reason"
          placeholder="e.g. UPI ID does not match the KYC name"
          confirm="Reject"
          danger
          required
          onClose={() => setReject(null)}
          onSubmit={(note) => rejectWithdrawal(reject, note)}
        />
      )}
    </>
  );
}
