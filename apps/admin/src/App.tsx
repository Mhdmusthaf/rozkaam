import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './data/store';
import { Toasts } from './ui';
import Layout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Approvals from './pages/Approvals';
import Requirements from './pages/Requirements';
import RequirementDetail from './pages/RequirementDetail';
import { BusinessKyc, WorkerKyc } from './pages/Kyc';
import Workers from './pages/Workers';
import Businesses from './pages/Businesses';
import Flags from './pages/Flags';
import Withdrawals from './pages/Withdrawals';
import Ledger from './pages/Ledger';
import SettingsPage from './pages/Settings';
import Audit from './pages/Audit';

export default function App() {
  const { authed, live, loaded, loading, refresh } = useStore();
  return (
    <HashRouter>
      {authed && live && !loaded ? (
        <div className="empty" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 12 }}>
          <strong>{loading ? 'Loading from the Rozkaam server…' : 'Could not load from the Rozkaam server'}</strong>
          {!loading && <button className="btn" onClick={() => void refresh()}>Try again</button>}
        </div>
      ) : authed ? (
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/approvals/:id" element={<Approvals />} />
            <Route path="/requirements" element={<Requirements />} />
            <Route path="/requirements/:id" element={<RequirementDetail />} />
            <Route path="/kyc/workers" element={<WorkerKyc />} />
            <Route path="/kyc/businesses" element={<BusinessKyc />} />
            <Route path="/workers" element={<Workers />} />
            <Route path="/businesses" element={<Businesses />} />
            <Route path="/flags" element={<Flags />} />
            <Route path="/withdrawals" element={<Withdrawals />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      ) : (
        <Login />
      )}
      <Toasts />
    </HashRouter>
  );
}
