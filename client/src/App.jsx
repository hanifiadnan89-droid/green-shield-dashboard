import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout.jsx';
import TestModeBanner from './components/TestModeBanner.jsx';
import Leads from './pages/Leads.jsx';
import SendTemplate from './pages/SendTemplate.jsx';
import Workflows from './pages/Workflows.jsx';
import Followups from './pages/Followups.jsx';
import ActivityLog from './pages/ActivityLog.jsx';
import ComponentPreview from './pages/ComponentPreview.jsx';
import CRMPreview from './pages/CRMPreview/index.jsx';
import { api } from './api/client.js';

function AppShell({ testMode, credsMissing }) {
  return (
    <Layout testMode={testMode}>
      <TestModeBanner testMode={testMode} />
      {credsMissing && (
        <div className="bg-gs-info/10 border-b border-gs-info/30 px-4 py-2 text-gs-info text-xs flex items-center gap-2">
          <span className="font-bold">Setup required:</span>
          Google credentials not configured — add GOOGLE_SERVICE_ACCOUNT_JSON to your .env file.
          Lead data will not load until credentials are set.
        </div>
      )}
      <Outlet />
    </Layout>
  );
}

export default function App() {
  const [testMode, setTestMode] = useState(null);
  const [credsMissing, setCredsMissing] = useState(false);

  useEffect(() => {
    api.health().then(data => {
      setTestMode(data.testMode);
      setCredsMissing(!data.hasGoogleCreds);
    }).catch(() => {
      setTestMode(true);
    });
  }, []);

  return (
    <Routes>
      <Route path="/" element={<CRMPreview testMode={testMode} />} />
      <Route path="/dashboard-classic" element={<Navigate to="/" replace />} />
      <Route element={<AppShell testMode={testMode} credsMissing={credsMissing} />}>
        <Route path="/leads" element={<Leads />} />
        <Route path="/send" element={<SendTemplate testMode={testMode} />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/followups" element={<Followups />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/component-preview" element={<ComponentPreview />} />
      </Route>
    </Routes>
  );
}
