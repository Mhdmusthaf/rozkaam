import type { CommissionMode } from './types';

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const inrShort = (n: number) => {
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return inr(n);
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const dayOffset = (iso: string) =>
  Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / 86400000);

export const fmtDate = (iso: string) => {
  const off = dayOffset(iso);
  if (off === 0) return 'Today';
  if (off === 1) return 'Tomorrow';
  if (off === -1) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (iso: string) =>
  `${fmtDate(iso)}, ${new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/** Money split for one worker slot under a commission rate and mode. */
export function split(pay: number, rate: number, mode: CommissionMode) {
  const fee = Math.round((pay * rate) / 100);
  return mode === 'on_top'
    ? { businessPays: pay + fee, workerGets: pay, fee }
    : { businessPays: pay, workerGets: pay - fee, fee };
}

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
