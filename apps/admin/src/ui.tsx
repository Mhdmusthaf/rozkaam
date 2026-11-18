import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Star, X, XCircle } from 'lucide-react';
import markRaw from './assets/logomark-colour.svg?raw';
import wordRaw from './assets/wordmark-colour.svg?raw';
import { useStore } from './data/store';
import { titleCase } from './data/format';
import type { AccountStatus, AppStatus, KycStatus, ReqStatus } from './data/types';

/* The brand SVGs both use .cls-1/.cls-2 in an embedded stylesheet, which would clash once inlined.
   Strip the stylesheet and paint the shapes directly. */
function paint(raw: string, viewBox: string, c1: string, c2: string) {
  return raw
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<defs>[\s\S]*?<\/defs>/, '')
    .replace(/viewBox="[^"]*"/, `viewBox="${viewBox}" width="100%" height="100%"`)
    .replace(/ id="Layer_1"/, '')
    .replace(/class="cls-1"/g, `fill="${c1}"`)
    .replace(/class="cls-2"/g, `fill="${c2}"`);
}

export function Logomark({ size = 30, white = false }: { size?: number; white?: boolean }) {
  const html = paint(markRaw, '330 400 1260 1120', white ? '#ffffff' : '#b1c2cc', white ? '#ffffff' : '#6601f9');
  return <span aria-hidden style={{ width: size, height: size * 0.89, display: 'inline-block', flex: 'none' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Wordmark({ height = 18, color = '#6601f9' }: { height?: number; color?: string }) {
  const html = paint(wordRaw, '275 495 1365 210', color, color);
  return <span role="img" aria-label="Rozkaam" style={{ height, width: height * 6.5, display: 'inline-block', flex: 'none' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Pill({ tone, children }: { tone?: 'ok' | 'warn' | 'bad' | 'info' | 'violet'; children: ReactNode }) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}

const REQ_TONE: Record<ReqStatus, 'ok' | 'warn' | 'bad' | 'info' | 'violet' | undefined> = {
  awaiting_funding: 'warn', open: 'violet', filled: 'info', in_progress: 'ok', completed: undefined, cancelled: 'bad',
};
export const ReqPill = ({ s }: { s: ReqStatus }) => <Pill tone={REQ_TONE[s]}>{titleCase(s)}</Pill>;

const APP_TONE: Record<AppStatus, 'ok' | 'warn' | 'bad' | 'info' | 'violet' | undefined> = {
  applied: 'violet', approved: 'info', waitlisted: 'warn', rejected: 'bad', checked_in: 'ok', checked_out: 'ok', paid: 'ok', withdrawn: undefined, late_cancel: 'bad', no_show: 'bad',
};
const APP_LABEL: Partial<Record<AppStatus, string>> = { approved: 'Confirmed', late_cancel: 'Late cancel', no_show: 'No-show' };
export const AppPill = ({ s }: { s: AppStatus }) => <Pill tone={APP_TONE[s]}>{APP_LABEL[s] ?? titleCase(s)}</Pill>;

export const AccountPill = ({ s }: { s: AccountStatus }) => (
  <Pill tone={s === 'active' ? 'ok' : s === 'restricted' ? 'warn' : 'bad'}>{titleCase(s)}</Pill>
);
export const KycPill = ({ s }: { s: KycStatus }) => (
  <Pill tone={s === 'verified' ? 'ok' : s === 'pending' ? 'warn' : s === 'none' ? undefined : 'bad'}>{s === 'none' ? 'KYC not submitted' : `KYC ${s}`}</Pill>
);

export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function Person({ name, sub, square }: { name: string; sub?: ReactNode; square?: boolean }) {
  return (
    <div className="person">
      <div className={`avatar ${square ? 'sq' : ''}`}>{initials(name)}</div>
      <div className="grow">
        <b>{name}</b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  if (!value) return <span className="muted">New</span>;
  return (
    <span className="row gap-4 nowrap num">
      <Star size={13} fill="#f5a524" color="#f5a524" />
      <b>{value.toFixed(1)}</b>
      {count !== undefined && <span className="muted small">({count})</span>}
    </span>
  );
}

export function Meter({ value }: { value: number }) {
  const tone = value >= 85 ? 'ok' : value >= 65 ? 'warn' : 'bad';
  return (
    <div className="row gap-6">
      <div className={`meter ${tone}`}><i style={{ width: `${value}%` }} /></div>
      <span className="num small" style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Drawer({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** A small "confirm with a note" dialog used for reasons, references and notes. */
export function PromptModal(props: {
  title: string;
  body?: ReactNode;
  label: string;
  placeholder?: string;
  confirm: string;
  danger?: boolean;
  required?: boolean;
  multiline?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [v, setV] = useState('');
  const ok = !props.required || v.trim().length > 0;
  return (
    <Modal title={props.title} onClose={props.onClose}>
      {props.body && <p className="muted mt-8">{props.body}</p>}
      <label className="field mt-16">
        <span>{props.label}</span>
        {props.multiline ? (
          <textarea className="input" autoFocus value={v} placeholder={props.placeholder} onChange={(e) => setV(e.target.value)} />
        ) : (
          <input className="input" autoFocus value={v} placeholder={props.placeholder} onChange={(e) => setV(e.target.value)} />
        )}
      </label>
      <div className="modal-actions">
        <button className="btn ghost" onClick={props.onClose}>Cancel</button>
        <button
          className={`btn ${props.danger ? 'danger' : ''}`}
          disabled={!ok}
          onClick={() => { props.onSubmit(v.trim()); props.onClose(); }}
        >
          {props.confirm}
        </button>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'ok' ? <CheckCircle2 size={16} /> : t.tone === 'warn' ? <AlertTriangle size={16} /> : <XCircle size={16} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function Kpi({ label, value, hint, icon, accent }: { label: string; value: ReactNode; hint?: string; icon: ReactNode; accent?: boolean }) {
  return (
    <div className={`card kpi ${accent ? 'accent' : ''}`}>
      <div className="label"><span className="ico">{icon}</span>{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
