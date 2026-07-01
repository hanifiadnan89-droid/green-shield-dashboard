import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import Layout from './components/Layout.jsx';
import { AnimatedOutlet } from './components/PageTransition.jsx';
import TestModeBanner from './components/TestModeBanner.jsx';
import CRMPreview from './pages/CRMPreview/index.jsx';
import LoginPage from './pages/Login/LoginPage.jsx';
import './pages/Login/dashboardEntrance.css';
import { api } from './api/client.js';

const Leads            = lazy(() => import('./pages/Leads.jsx'));
const SendTemplate     = lazy(() => import('./pages/SendTemplate.jsx'));
const Replies          = lazy(() => import('./pages/Replies.jsx'));
const Workflows        = lazy(() => import('./pages/Workflows.jsx'));
const Followups        = lazy(() => import('./pages/Followups.jsx'));
const ActivityLog      = lazy(() => import('./pages/ActivityLog.jsx'));
const ErrorCenter      = lazy(() => import('./pages/ErrorCenter.jsx'));
const ComponentPreview = lazy(() => import('./pages/ComponentPreview.jsx'));
const RouteFinderPage  = lazy(() => import('./pages/RouteFinder/RouteFinderPage.jsx'));
const IntakeGate         = lazy(() => import('./pages/Intake/IntakeGate.jsx'));
const IntakePropertyGate = lazy(() => import('./pages/Intake/IntakePropertyGate.jsx'));
const AgreementSignPage = lazy(() => import('./pages/AgreementSign/AgreementSignPage.jsx'));
const SalesCoachPage    = lazy(() => import('./pages/SalesCoach/SalesCoachPage.jsx'));
const AdminUsersPage    = lazy(() => import('./pages/Admin/Users/AdminUsersPage.jsx'));
const AdminIntegrationsPage = lazy(() => import('./pages/Admin/Users/UserIntegrationsPage.jsx'));
const AIObservabilityPage = lazy(() => import('./pages/Admin/AIObservability/AIObservabilityPage.jsx'));

function googleCredsBannerMessage(googleCreds) {
  if (googleCreds?.message) return googleCreds.message;
  if (googleCreds?.status === 'invalid_json' && googleCreds?.parseError) {
    return `GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (${googleCreds.parseError}). On Render, paste the full service account JSON as one line.`;
  }
  return 'Google credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON in Render Environment or server/.env locally.';
}

function AppShell({ testMode, credsMissing, googleCreds, currentUser }) {
  const { pathname } = useLocation();
  const hideGoogleBanner = pathname.startsWith('/tools/route-finder');
  const suppressLiveBanner =
    pathname === '/replies' || pathname.startsWith('/replies/')
    || pathname === '/leads' || pathname.startsWith('/leads/')
    || pathname === '/followups' || pathname.startsWith('/followups/')
    || pathname.startsWith('/tools/route-finder');

  return (
    <Layout testMode={testMode} currentUser={currentUser}>
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

function DashboardRoutes({ testMode, credsMissing, googleCreds, currentUser }) {
  return (
    <Routes>
      <Route path="/dashboard-classic" element={<Navigate to="/" replace />} />
      <Route element={<AppShell testMode={testMode} credsMissing={credsMissing} googleCreds={googleCreds} currentUser={currentUser} />}>
        <Route path="/" element={<CRMPreview />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/send" element={<SendTemplate testMode={testMode} />} />
        <Route path="/replies" element={<Replies />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/followups" element={<Followups />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/errors" element={<ErrorCenter />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/:userId/integrations" element={<AdminIntegrationsPage />} />
        <Route path="/admin/ai-observability" element={<AIObservabilityPage />} />
        <Route path="/tools/route-finder" element={<RouteFinderPage />} />
        <Route path="/sales-coach" element={<SalesCoachPage />} />
        <Route path="/intake" element={<IntakeGate />} />
        <Route path="/intake/property" element={<IntakePropertyGate />} />
        <Route path="/component-preview" element={<ComponentPreview />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [testMode, setTestMode] = useState(null);
  const [credsMissing, setCredsMissing] = useState(false);
  const [googleCreds, setGoogleCreds] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // auth state: null = checking, true = authed, false = needs login
  const [authState, setAuthState] = useState(null);

  // One-shot dashboard entrance flag (set right after a fresh login).
  const [freshLogin, setFreshLogin] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const data = await api.auth.status();
      setAuthState(Boolean(data?.authenticated));
      setCurrentUser(data?.currentUser ?? null);
    } catch {
      setAuthState(false);
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    function onExpired() {
      setAuthState(false);
      setCurrentUser(null);
    }
    window.addEventListener('gs:auth-expired', onExpired);
    return () => window.removeEventListener('gs:auth-expired', onExpired);
  }, []);

  useEffect(() => {
    if (authState !== true) return;
    api.health().then(data => {
      setTestMode(data.testMode);
      setGoogleCreds(data.googleCreds ?? null);
      setCredsMissing(data.hasGoogleCreds === false);
    }).catch(() => {
      setTestMode(true);
      setCredsMissing(false);
    });
  }, [authState]);

  const handleAuthenticated = useCallback(() => {
    setFreshLogin(true);
    setAuthState(true);
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!freshLogin) return;
    // Remove the entrance class after the staggered animation completes
    // so subsequent renders don't replay it.
    const t = window.setTimeout(() => setFreshLogin(false), 1600);
    return () => window.clearTimeout(t);
  }, [freshLogin]);

  // Public routes (signing page) must work without auth.
  const isPublicRoute = typeof window !== 'undefined'
    && window.location.pathname.startsWith('/sign/');

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/sign/:token" element={
          <Suspense fallback={<div className="p-6 text-sm text-gs-muted">Loading agreement…</div>}>
            <AgreementSignPage />
          </Suspense>
        } />
      </Routes>
    );
  }

  if (authState === null) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#050807', color: 'rgba(167,243,208,0.6)',
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, letterSpacing: '0.03em',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '2px solid rgba(74,222,128,0.25)', borderTopColor: '#4ade80',
          animation: 'login-spin 700ms linear infinite', marginRight: 12,
        }} />
        Verifying session…
      </div>
    );
  }

  if (authState === false) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className={freshLogin ? 'gs-fresh-login' : undefined}>
      <DashboardRoutes testMode={testMode} credsMissing={credsMissing} googleCreds={googleCreds} currentUser={currentUser} />
    </div>
  );
}
