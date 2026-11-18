import { useState } from 'react';
import { Save } from 'lucide-react';
import { useStore } from '../data/store';
import { inr, split } from '../data/format';
import type { Settings } from '../data/types';
import { PageHead } from '../ui';

function Num({ label, hint, value, unit, min, max, step = 1, onChange }: { label: string; hint: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="row">
        <input className="input num" type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))} style={{ maxWidth: 120 }} />
        <span className="muted">{unit}</span>
      </div>
      <small>{hint}</small>
    </label>
  );
}

export default function SettingsPage() {
  const { db, saveSettings } = useStore();
  const [s, setS] = useState<Settings>(db.settings);
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  const WORKERS = 10, PAY = 800;
  const sp = split(PAY, s.commissionRate, s.commissionMode);

  return (
    <>
      <PageHead title="Settings" sub="Platform rules. Changes apply to requirements posted from now on; each existing requirement keeps the rate and mode it was posted under.">
        <button className="btn ghost" disabled={!dirty} onClick={() => setS(db.settings)}>Discard</button>
        <button className="btn" disabled={!dirty} onClick={() => saveSettings(s)}><Save size={15} /> Save changes</button>
      </PageHead>

      <div className="grid two">
        <div className="card col gap-20">
          <div>
            <h2>Commission</h2>
            <p className="muted small mt-4">Who bears the commission has not been decided yet, so both ways are supported.</p>
          </div>
          <Num label="Commission rate" hint="Planning range is 10% to 20%. The base assumption is 15%." value={s.commissionRate} unit="%" min={0} max={40} step={0.5} onChange={(n) => set('commissionRate', n)} />
          <div className="field">
            <span>Commission mode</span>
            <div className="grid halves" style={{ gap: 10 }}>
              <button type="button" className={`pick ${s.commissionMode === 'on_top' ? 'on' : ''}`} style={{ boxShadow: 'none', border: `1.5px solid ${s.commissionMode === 'on_top' ? 'var(--violet)' : 'var(--line)'}` }} onClick={() => set('commissionMode', 'on_top')}>
                <b>On top</b>
                <div className="muted small mt-4">The worker gets the full advertised pay. The business pays the pay plus the commission.</div>
              </button>
              <button type="button" className={`pick ${s.commissionMode === 'deducted' ? 'on' : ''}`} style={{ boxShadow: 'none', border: `1.5px solid ${s.commissionMode === 'deducted' ? 'var(--violet)' : 'var(--line)'}` }} onClick={() => set('commissionMode', 'deducted')}>
                <b>Deducted</b>
                <div className="muted small mt-4">The business pays the advertised pay. The commission comes out of what the worker receives.</div>
              </button>
            </div>
          </div>
        </div>

        <div className="example">
          <h2>Worked example</h2>
          <p className="muted small mt-4">{WORKERS} workers × {inr(PAY)} advertised pay, at {s.commissionRate}% {s.commissionMode === 'on_top' ? 'on top' : 'deducted'}</p>
          <table className="mt-16">
            <tbody>
              <tr><td>Each worker receives</td><td className="right num"><b>{inr(sp.workerGets)}</b></td></tr>
              <tr><td>Business pays per worker</td><td className="right num"><b>{inr(sp.businessPays)}</b></td></tr>
              <tr><td>GMV (work value)</td><td className="right num">{inr(PAY * WORKERS)}</td></tr>
              <tr><td>Total worker payouts</td><td className="right num">{inr(sp.workerGets * WORKERS)}</td></tr>
              <tr><td>Business funds up front</td><td className="right num">{inr(sp.businessPays * WORKERS)}</td></tr>
              <tr className="total"><td>Rozkaam revenue</td><td className="right num">{inr(sp.fee * WORKERS)}</td></tr>
            </tbody>
          </table>
          <p className="muted small mt-16">The worker app always shows the amount the worker will actually receive ({inr(sp.workerGets)} here).</p>
        </div>
      </div>

      <div className="card mt-16">
        <h2>Operating rules</h2>
        <div className="grid halves mt-16" style={{ gap: 20 }}>
          <Num label="Cancellation window" hint="Workers can cancel without a strike up to this long before the start time." value={s.cancelWindowHours} unit="hours before start" min={1} max={72} onChange={(n) => set('cancelWindowHours', n)} />
          <Num label="Discovery radius" hint="Workers see jobs within this distance of their location." value={s.radiusKm} unit="km" min={1} max={100} onChange={(n) => set('radiusKm', n)} />
          <Num label="Check-in geofence" hint="Check-ins further than this from the venue are flagged for review." value={s.geofenceM} unit="metres" min={50} max={5000} step={50} onChange={(n) => set('geofenceM', n)} />
          <Num label="Reminder lead time" hint="Confirmed workers get a push and email reminder this long before reporting time." value={s.reminderHours} unit="hours before" min={1} max={24} onChange={(n) => set('reminderHours', n)} />
        </div>
      </div>
    </>
  );
}
