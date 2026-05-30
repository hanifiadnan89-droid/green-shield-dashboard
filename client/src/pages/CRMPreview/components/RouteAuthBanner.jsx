// ---------------------------------------------------------------------------
// Auth status banner — extracted from RouteFinderWidget.jsx (Phase 11 step 1)
// Always mounted, never conditional.
// ---------------------------------------------------------------------------
import { useState, useRef, useEffect } from 'react';
import { api } from '../../../api/client.js';

const LOGIN_CONFIRM_INTERVAL_MS = 5000;
const LOGIN_CONFIRM_MAX_ATTEMPTS = 72; // 6 minutes, matching the login script window plus a little slack

function AuthStatusBanner({ authInfo, onLoginRefreshStarted }) {
  const [refreshState, setRefreshState] = useState('idle'); // idle | loading | waiting | checking | done | error
  const loginPollRef = useRef(null);
  const isLocalDashboard = typeof window !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => () => {
    if (loginPollRef.current) clearInterval(loginPollRef.current);
  }, []);

  const isChecking = authInfo.status === 'checking';
  const isOk       = authInfo.status === 'ok';
  const isLogin    = authInfo.status === 'needs_login';
  const isFailed   = authInfo.status === 'failed';

  const dotColor  = isChecking ? '#94A3B8' : isOk ? '#16A34A' : isFailed ? '#DC2626' : '#F59E0B';
  const textColor = isChecking ? '#64748B' : isOk ? '#16A34A' : isFailed ? '#DC2626' : '#B45309';
  const bg        = isChecking ? 'rgba(148,163,184,0.06)' : isOk ? 'rgba(22,163,74,0.05)' : isFailed ? 'rgba(220,38,38,0.05)' : 'rgba(245,158,11,0.07)';
  const border    = isChecking ? 'rgba(148,163,184,0.2)' : isOk ? 'rgba(22,163,74,0.18)' : isFailed ? 'rgba(220,38,38,0.18)' : 'rgba(245,158,11,0.28)';
  const label     = isChecking ? 'Checking…' : isOk ? 'Connected' : isLogin ? 'Needs Login' : isFailed ? 'Failed' : 'Unknown';

  async function confirmLoginNow() {
    setRefreshState('checking');
    try {
      const statusData = await onLoginRefreshStarted?.({ checkAuth: true });
      if (statusData?._auth?.status === 'ok') {
        if (loginPollRef.current) {
          clearInterval(loginPollRef.current);
          loginPollRef.current = null;
        }
        setRefreshState('done');
        setTimeout(() => setRefreshState('idle'), 4000);
      } else {
        setRefreshState('waiting');
      }
    } catch {
      setRefreshState('error');
      setTimeout(() => setRefreshState('waiting'), 4000);
    }
  }

  async function handleLoginRefresh() {
    if (loginPollRef.current) {
      clearInterval(loginPollRef.current);
      loginPollRef.current = null;
    }
    setRefreshState('loading');
    try {
      await api.routes.loginRefresh();
      setRefreshState('waiting');
      onLoginRefreshStarted?.({ checkAuth: false });

      let attempts = 0;
      loginPollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const statusData = await onLoginRefreshStarted?.({ checkAuth: true });
          if (statusData?._auth?.status === 'ok') {
            clearInterval(loginPollRef.current);
            loginPollRef.current = null;
            setRefreshState('done');
            setTimeout(() => setRefreshState('idle'), 4000);
          }
        } catch { /* keep polling until timeout */ }

        if (attempts >= LOGIN_CONFIRM_MAX_ATTEMPTS && loginPollRef.current) {
          clearInterval(loginPollRef.current);
          loginPollRef.current = null;
          setRefreshState('error');
          setTimeout(() => setRefreshState('idle'), 6000);
        }
      }, LOGIN_CONFIRM_INTERVAL_MS);
    } catch {
      setRefreshState('error');
      setTimeout(() => setRefreshState('idle'), 4000);
    }
  }

  const btnLabel = refreshState === 'loading' ? 'Opening…'
    : refreshState === 'checking' ? 'Checking…'
    : refreshState === 'waiting' && isLocalDashboard ? 'Check Login'
    : refreshState === 'done'    ? 'Auth confirmed ✓'
    : refreshState === 'error'   ? 'Not confirmed — retry'
    : isLocalDashboard ? 'Refresh Login'
    : 'Check Auth';

  const btnColor = refreshState === 'done' ? '#16A34A'
    : refreshState === 'error' ? '#DC2626'
    : '#B45309';

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ padding: '5px 9px', borderRadius: 8, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: textColor }}>
            FieldRoutes: {label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {authInfo.lastCheckFormatted && (
            <span style={{ fontSize: 9, color: '#94A3B8' }}>checked {authInfo.lastCheckFormatted}</span>
          )}
          {authInfo.lastRefreshFormatted && (
            <span style={{ fontSize: 9, color: '#94A3B8' }}>refreshed {authInfo.lastRefreshFormatted}</span>
          )}
          {(isLogin || isFailed) && (
            <button
              onClick={!isLocalDashboard || refreshState === 'waiting' ? confirmLoginNow : handleLoginRefresh}
              disabled={refreshState === 'loading' || refreshState === 'checking'}
              style={{
                fontSize: 9, fontWeight: 700, color: '#fff',
                background: btnColor,
                border: 'none', borderRadius: 5, padding: '2px 7px',
                cursor: refreshState === 'loading' || refreshState === 'checking' ? 'default' : 'pointer',
                opacity: refreshState === 'loading' || refreshState === 'checking' ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {btnLabel}
            </button>
          )}
        </div>
      </div>
      {isFailed && authInfo.message && (
        <div style={{ marginTop: 5, padding: '5px 9px', borderRadius: 7, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.18)' }}>
          <span style={{ fontSize: 9, color: '#DC2626' }}>{authInfo.message}</span>
        </div>
      )}
      {isLogin && !isLocalDashboard && (
        <div style={{ marginTop: 5, padding: '5px 9px', borderRadius: 7, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <span style={{ fontSize: 9, color: '#B45309' }}>
            Update FIELDROUTES_AUTH_STATE_JSON in Render, redeploy, then click Check Auth.
          </span>
        </div>
      )}
    </div>
  );
}

export default AuthStatusBanner;
