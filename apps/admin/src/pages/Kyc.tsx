import { useState } from 'react';
import { Check, FileText, IdCard, ScanFace, X } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtDateTime } from '../data/format';
import { Empty, KycPill, PageHead, Person, PromptModal } from '../ui';

function Doc({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="doc">
      <div>{icon}{label}<div style={{ fontWeight: 500, marginTop: 2 }}>Demo placeholder</div></div>
    </div>
  );
}

export function WorkerKyc() {
  const { db, reviewWorkerKyc } = useStore();
  const [reject, setReject] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'rejected'>('pending');
  const rows = db.workers.filter((w) => w.kyc === tab).sort((a, b) => a.kycSubmitted.localeCompare(b.kycSubmitted));

  return (
    <>
      <PageHead title="Worker KYC" sub="Check the ID and selfie against the profile before a worker can apply for jobs. Oldest submissions first.">
        <div className="seg">
          <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Pending ({db.workers.filter((w) => w.kyc === 'pending').length})</button>
          <button className={tab === 'rejected' ? 'on' : ''} onClick={() => setTab('rejected')}>Rejected</button>
        </div>
      </PageHead>
      {rows.length === 0 && <div className="card"><Empty title={tab === 'pending' ? 'KYC queue is clear' : 'No rejected submissions'}>New submissions appear here.</Empty></div>}
      <div className="grid halves">
        {rows.map((w) => (
          <div key={w.id} className="card col gap-16">
            <div className="row between">
              <Person name={w.name} sub={`${w.id} · submitted ${fmtDateTime(w.kycSubmitted)}`} />
              <KycPill s={w.kyc} />
            </div>
            <div className="grid halves" style={{ gap: 10 }}>
              <Doc label={`${w.kycDocType} photo`} icon={<IdCard size={22} />} />
              <Doc label="Selfie" icon={<ScanFace size={22} />} />
            </div>
            <dl className="dl">
              <dt>ID</dt><dd className="num">{w.kycDocType} ending {w.kycDocLast4}</dd>
              <dt>Phone</dt><dd className="num">{w.phone}</dd>
              <dt>Age / gender</dt><dd>{w.age} · {w.gender}</dd>
              <dt>Location</dt><dd>{w.area}, {w.district}</dd>
              <dt>Skills</dt><dd>{w.skills.map((s) => <span key={s} className="chip">{s}</span>)}</dd>
              <dt>Experience</dt><dd>{w.experience}</dd>
              <dt>Payout UPI</dt><dd className="num">{w.upi}</dd>
              {w.kycRejectReason && <><dt>Rejected because</dt><dd style={{ color: 'var(--bad)' }}>{w.kycRejectReason}</dd></>}
            </dl>
            <div className="row">
              <button className="btn ok grow" onClick={() => reviewWorkerKyc(w.id, true)}><Check size={15} /> Approve</button>
              {w.kyc === 'pending' && <button className="btn danger grow" onClick={() => setReject(w.id)}><X size={15} /> Reject</button>}
            </div>
          </div>
        ))}
      </div>
      {reject && (
        <PromptModal
          title="Reject this KYC submission?"
          body="The worker is told why and can submit again."
          label="Reason"
          placeholder="e.g. ID photo is blurred"
          confirm="Reject"
          danger
          required
          onClose={() => setReject(null)}
          onSubmit={(reason) => reviewWorkerKyc(reject, false, reason)}
        />
      )}
    </>
  );
}

export function BusinessKyc() {
  const { db, reviewBusinessKyc } = useStore();
  const [reject, setReject] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'rejected'>('pending');
  const rows = db.businesses.filter((b) => b.kyc === tab).sort((a, b) => a.kycSubmitted.localeCompare(b.kycSubmitted));

  return (
    <>
      <PageHead title="Business KYC" sub="Verify registration documents before a business can post and fund requirements.">
        <div className="seg">
          <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Pending ({db.businesses.filter((b) => b.kyc === 'pending').length})</button>
          <button className={tab === 'rejected' ? 'on' : ''} onClick={() => setTab('rejected')}>Rejected</button>
        </div>
      </PageHead>
      {rows.length === 0 && <div className="card"><Empty title={tab === 'pending' ? 'KYC queue is clear' : 'No rejected submissions'}>New submissions appear here.</Empty></div>}
      <div className="grid halves">
        {rows.map((b) => (
          <div key={b.id} className="card col gap-16">
            <div className="row between">
              <Person square name={b.name} sub={`${b.id} · submitted ${fmtDateTime(b.kycSubmitted)}`} />
              <KycPill s={b.kyc} />
            </div>
            <div className="grid thirds" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {b.docs.map((d) => <Doc key={d} label={d} icon={<FileText size={20} />} />)}
            </div>
            <dl className="dl">
              <dt>Category</dt><dd>{b.category}</dd>
              <dt>GSTIN</dt><dd className="num">{b.gstin}</dd>
              <dt>Address</dt><dd style={{ fontWeight: 500 }}>{b.address}</dd>
              <dt>Contact person</dt><dd>{b.contactName}</dd>
              <dt>Phone</dt><dd className="num">{b.contactPhone}</dd>
              <dt>Email</dt><dd>{b.email}</dd>
              {b.kycRejectReason && <><dt>Rejected because</dt><dd style={{ color: 'var(--bad)' }}>{b.kycRejectReason}</dd></>}
            </dl>
            <div className="row">
              <button className="btn ok grow" onClick={() => reviewBusinessKyc(b.id, true)}><Check size={15} /> Approve</button>
              {b.kyc === 'pending' && <button className="btn danger grow" onClick={() => setReject(b.id)}><X size={15} /> Reject</button>}
            </div>
          </div>
        ))}
      </div>
      {reject && (
        <PromptModal
          title="Reject this business?"
          body="The business is told why and can upload new documents."
          label="Reason"
          placeholder="e.g. GST certificate does not match the business name"
          confirm="Reject"
          danger
          required
          onClose={() => setReject(null)}
          onSubmit={(reason) => reviewBusinessKyc(reject, false, reason)}
        />
      )}
    </>
  );
}
