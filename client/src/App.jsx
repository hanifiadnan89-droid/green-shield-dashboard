import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import Layout from './components/Layout.jsx';
import { AnimatedOutlet } from './components/PageTransition.jsx';
import TestModeBanner from './components/TestModeBanner.jsx';
import CRMPreview from './pages/CRMPreview/index.jsx';
import { api } from './api/client.js';

const Leads            = lazy(() => import('./pages/Leads.jsx'));
const SendTemplate     = lazy(() => import('./pages/SendTemplate.jsx'));
const Replies          = lazy(() => import('./pages/Replies.jsx'));
const Workflows        = lazy(() => import('./pages/Workflows.jsx'));
const Followups        = lazy(() => import('./pages/Followups.jsx'));
const ActivityLog      = lazy(() => import('./pages/ActivityLog.jsx'));
const ComponentPreview = lazy(() => import('./pages/ComponentPreview.jsx'));
const RouteFinderPage  = lazy(() => import('./pages/RouteFinder/RouteFinderPage.jsx'));

function googleCredsBannerMessage(googleCreds) {
  if (googleCreds?.message) return googleCreds.message;
  if (googleCreds?.status === 'invalid_json' && googleCreds?.parseError) {
    return `GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (${googleCreds.parseError}). On Render, paste the full service account JSON as one line.`;
  }
  return 'Google credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON in Render Environment or server/.env locally.';
}

function AppShell({ testMode, credsMissing, googleCreds }) {
  const { pathname } = useLocation();
  const hideGoogleBanner = pathname.startsWith('/tools/route-finder');
  const suppressLiveBanner =
    pathname === '/replies' || pathname.startsWith('/replies/')
    || pathname === '/leads' || pathname.startsWith('/leads/')
    || pathname === '/followups' || pathname.startsWith('/followups/')
    || pathname.startsWith('/tools/route-finder');

  return (
    <Layout testMode={testMode}>
      <TestModeBanner testMode={testMode} suppressLiveBanner={suppressLiveBanner} />
      {credsMissing && !hideGoogleBanner && (
        <div className="bg-gs-info/10 border-b border-gs-info/30 px-4 py-2 text-gs-info text-xs flex items-center gap-2">
          <span className="font-bold">Setup required:</span>
          {googleCredsBannerMessage(googleCreds)}
          {googleCreds?.status && googleCreds.status !== 'missing' && (
            <span className="opacity-80"> (status: {googleCreds.status})</span>
          )}
        </div>
      )}
      <AnimatedOutlet className="page-transition-outlet flex-1 flex flex-col min-h-0 overflow-hidden" />
    </Layout>
  );
}

export default function App() {
  const [testMode, setTestMode] = useState(null);
  const [credsMissing, setCredsMissing] = useState(false);
  const [googleCreds, setGoogleCreds] = useState(null);

  useEffect(() => {
    api.health().then(data => {
      setTestMode(data.testMode);
      setGoogleCreds(data.googleCreds ?? null);
      setCredsMissing(data.hasGoogleCreds === false);
    }).catch(() => {
      setTestMode(true);
      setCredsMissing(false);
    });
  }, []);

  return (
    <Routes>
      <Route path="/dashboard-classic" element={<Navigate to="/" replace />} />
      <Route element={<AppShell testMode={testMode} credsMissing={credsMissing} googleCreds={googleCreds} />}>
        <Route path="/" element={<CRMPreview />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/send" element={<SendTemplate testMode={testMode} />} />
        <Route path="/replies" element={<Replies />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/followups" element={<Followups />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/tools/route-finder" element={<RouteFinderPage />} />
        <Route path="/component-preview" element={<ComponentPreview />} />
      </Route>
    </Routes>
  );
}
