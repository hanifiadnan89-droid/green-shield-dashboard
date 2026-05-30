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

  const isBtnDisabled = refreshState === 'loading' || refreshState === 'checking';

  return (
    <div className="mb-2.5">
      <div
        className="flex items-center justify-between rounded-lg px-[9px] py-[5px]"
        style={{ background: bg, border: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-[5px]">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: dotColor }}
          />
          <span className="text-[10px] font-bold" style={{ color: textColor }}>
            FieldRoutes: {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {authInfo.lastCheckFormatted && (
            <span className="text-[9px] text-slate-400">checked {authInfo.lastCheckFormatted}</span>
          )}
          {authInfo.lastRefreshFormatted && (
            <span className="text-[9px] text-slate-400">refreshed {authInfo.lastRefreshFormatted}</span>
          )}
          {(isLogin || isFailed) && (
            <button
              type="button"
              onClick={!isLocalDashboard || refreshState === 'waiting' ? confirmLoginNow : handleLoginRefresh}
              disabled={isBtnDisabled}
              className="border-0 rounded-[5px] py-0.5 px-[7px] text-[9px] font-bold text-white transition-opacity duration-150"
              style={{
                background: btnColor,
                cursor: isBtnDisabled ? 'default' : 'pointer',
                opacity: isBtnDisabled ? 0.7 : 1,
              }}
            >
              {btnLabel}
            </button>
          )}
        </div>
      </div>
      {isFailed && authInfo.message && (
        <div className="mt-1.5 rounded-[7px] border border-gs-danger/20 bg-gs-danger/[0.04] px-[9px] py-[5px]">
          <span className="text-[9px] text-gs-danger">{authInfo.message}</span>
        </div>
      )}
      {isLogin && !isLocalDashboard && (
        <div className="mt-1.5 rounded-[7px] border border-amber-500/20 bg-amber-500/5 px-[9px] py-[5px]">
          <span className="text-[9px] text-amber-700">
            Update FIELDROUTES_AUTH_STATE_JSON in Render, redeploy, then click Check Auth.
          </span>
        </div>
      )}
    </div>
  );
}

export default AuthStatusBanner;
