import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BadgeCheck, Banknote, BookText, Building2, ClipboardList, Flag, History, LayoutDashboard, LogOut, Menu, Settings, UserCheck, Users, Wallet,
} from 'lucide-react';
import { useStore } from './data/store';
import { Logomark, Wordmark } from './ui';

export function useQueueCounts() {
  const { db } = useStore();
  return {
    approvals: db.requirements.filter((r) => r.status === 'open').length,
    workerKyc: db.workers.filter((w) => w.kyc === 'pending').length,
    businessKyc: db.businesses.filter((b) => b.kyc === 'pending').length,
    flags: db.applications.filter((a) => a.checkIn?.flag && !a.checkIn.resolved).length,
    withdrawals: db.withdrawals.filter((w) => w.status === 'requested').length,
  };
}

export default function Layout() {
  const { logout, live, loading, adminPhone, refresh } = useStore();
  const c = useQueueCounts();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const item = (to: string, label: string, icon: React.ReactNode, count?: number) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      {icon}
      {label}
      {count ? <span className="count">{count}</span> : null}
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Logomark size={30} />
          <Wordmark height={16} color="#ffffff" />
          <span className="tag">ADMIN</span>
        </div>
        {item('/', 'Dashboard', <LayoutDashboard size={17} />)}
        <div className="nav-group">Daily operations</div>
        {item('/approvals', 'Applicant approval', <UserCheck size={17} />, c.approvals)}
        {item('/requirements', 'Requirements', <ClipboardList size={17} />)}
        {item('/flags', 'Attendance flags', <Flag size={17} />, c.flags)}
        <div className="nav-group">Verification</div>
        {item('/kyc/workers', 'Worker KYC', <BadgeCheck size={17} />, c.workerKyc)}
        {item('/kyc/businesses', 'Business KYC', <BadgeCheck size={17} />, c.businessKyc)}
        <div className="nav-group">People</div>
        {item('/workers', 'Workers', <Users size={17} />)}
        {item('/businesses', 'Businesses', <Building2 size={17} />)}
        <div className="nav-group">Money</div>
        {item('/withdrawals', 'Withdrawals', <Wallet size={17} />, c.withdrawals)}
        {item('/ledger', 'Ledger', <Banknote size={17} />)}
        <div className="nav-group">Platform</div>
        {item('/settings', 'Settings', <Settings size={17} />)}
        {item('/audit', 'Audit log', <History size={17} />)}
        <div className="sidebar-foot">
          <div className="avatar" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>DA</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{live ? (adminPhone ? `+91 ${adminPhone}` : 'Ops admin') : 'Demo Admin'}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>Ops team</div>
          </div>
          <button onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span className="row gap-6 muted small"><BookText size={15} /> Kochi · Ernakulam operations</span>
          <span className="grow" />
          {live ? (
            <>
              <button className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
              <span className="demo-tag" style={{ background: 'var(--ok-soft, #e2f6ea)', color: 'var(--ok, #0f8a45)' }}>Live data</span>
            </>
          ) : (
            <span className="demo-tag">Demo data</span>
          )}
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
