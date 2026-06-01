// ---------------------------------------------------------------------------
// Auth status banner — FieldRoutes session status + login / check actions
// ---------------------------------------------------------------------------
import { useState, useRef, useEffect } from 'react';
import { api } from '../../../api/client.js';

const LOGIN_CONFIRM_INTERVAL_MS = 5000;
const LOGIN_CONFIRM_MAX_ATTEMPTS = 72;

function isLocalHostname() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function feedbackTone(refreshState, authStatus) {
  if (refreshState === 'done' || authStatus === 'ok') return 'success';
  if (refreshState === 'error' || authStatus === 'failed') return 'error';
  return 'warn';
}

function AuthStatusBanner({ authInfo, onLoginRefreshStarted }) {
  const [refreshState, setRefreshState] = useState('idle');
  const [feedback, setFeedback] = useState('');
  const loginPollRef = useRef(null);
  const isLocalDashboard = isLocalHostname();

  useEffect(() => () => {
    if (loginPollRef.current) clearInterval(loginPollRef.current);
  }, []);

  useEffect(() => {
    if (refreshState !== 'idle' && refreshState !== 'done') return;
    if (authInfo.status === 'ok') {
      setFeedback('');
      return;
    }
    if (authInfo.status === 'needs_login' && !feedback) {
      setFeedback(
        isLocalDashboard
          ? 'FieldRoutes session expired. Click “Open Login” to sign in via Chromium on this computer.'
          : 'FieldRoutes session expired on the server. Update FIELDROUTES_AUTH_STATE_JSON in Render, redeploy, then click Check Auth.',
      );
    }
  }, [authInfo.status, authInfo.message, isLocalDashboard, refreshState, feedback]);

  const isChecking = authInfo.status === 'checking';
  const isOk = authInfo.status === 'ok';
  const isLogin = authInfo.status === 'needs_login';
  const isFailed = authInfo.status === 'failed';

  const dotColor = isChecking ? '#94A3B8' : isOk ? '#16A34A' : isFailed ? '#DC2626' : '#F59E0B';
  const textColor = isChecking ? '#64748B' : isOk ? '#16A34A' : isFailed ? '#DC2626' : '#B45309';
  const bg = isChecking ? 'rgba(148,163,184,0.06)' : isOk ? 'rgba(22,163,74,0.05)' : isFailed ? 'rgba(220,38,38,0.05)' : 'rgba(245,158,11,0.07)';
  const border = isChecking ? 'rgba(148,163,184,0.2)' : isOk ? 'rgba(22,163,74,0.18)' : isFailed ? 'rgba(220,38,38,0.18)' : 'rgba(245,158,11,0.28)';
  const label = isChecking ? 'Checking…' : isOk ? 'Connected' : isLogin ? 'Needs Login' : isFailed ? 'Failed' : 'Unknown';

  function applyAuthResult(statusData) {
    const auth = statusData?._auth;
    if (auth?.status === 'ok') {
      if (loginPollRef.current) {
        clearInterval(loginPollRef.current);
        loginPollRef.current = null;
      }
      setRefreshState('done');
      setFeedback('FieldRoutes connected. Route dates are loading…');
      setTimeout(() => {
        setRefreshState('idle');
        setFeedback('');
      }, 5000);
      return;
    }

    if (auth?.status === 'needs_login') {
      setRefreshState(isLocalDashboard ? 'waiting' : 'idle');
      setFeedback(
        auth.message
          || (isLocalDashboard
            ? 'Still not logged in. Complete sign-in in the Chromium window, then click “Check Login”.'
            : 'Still needs login. Update FIELDROUTES_AUTH_STATE_JSON in Render, redeploy, then click Check Auth again.'),
      );
      return;
    }

    if (auth?.status === 'failed') {
      setRefreshState('error');
      setFeedback(auth.message || 'FieldRoutes auth check failed.');
      return;
    }

    setRefreshState('idle');
    setFeedback('Could not verify FieldRoutes auth. Try again.');
  }

  async function confirmLoginNow() {
    setRefreshState('checking');
    setFeedback('Checking FieldRoutes session…');
    try {
      const statusData = await onLoginRefreshStarted?.({ checkAuth: true });
      applyAuthResult(statusData);
    } catch (err) {
      setRefreshState('error');
      setFeedback(err?.message || 'Auth check request failed.');
      setTimeout(() => setRefreshState('idle'), 6000);
    }
  }

  function startLoginPoll() {
    let attempts = 0;
    loginPollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const statusData = await onLoginRefreshStarted?.({ checkAuth: true });
        if (statusData?._auth?.status === 'ok') {
          applyAuthResult(statusData);
        }
      } catch (err) {
        setRefreshState('error');
        setFeedback(err?.message || 'Auth check failed while waiting for login.');
      }

      if (attempts >= LOGIN_CONFIRM_MAX_ATTEMPTS && loginPollRef.current) {
        clearInterval(loginPollRef.current);
        loginPollRef.current = null;
        setRefreshState('error');
        setFeedback('Login not detected after 6 minutes. Click “Open Login” to try again.');
        setTimeout(() => setRefreshState('waiting'), 6000);
      }
    }, LOGIN_CONFIRM_INTERVAL_MS);
  }

  async function handleLoginRefresh() {
    if (loginPollRef.current) {
      clearInterval(loginPollRef.current);
      loginPollRef.current = null;
    }
    setRefreshState('loading');
    setFeedback('Starting FieldRoutes login browser on this computer…');
    try {
      const result = await api.routes.loginRefresh();
      setRefreshState('waiting');
      setFeedback(
        result?.message
          || 'Chromium should open — log in to FieldRoutes there. This dashboard will detect when you are connected.',
      );
      onLoginRefreshStarted?.({ checkAuth: false });
      startLoginPoll();
    } catch (err) {
      setRefreshState('error');
      setFeedback(
        err?.message
          || 'Could not start login browser. Run: node scripts/fieldRoutesLogin.mjs',
      );
      setTimeout(() => setRefreshState('idle'), 8000);
    }
  }

  function handleAuthButtonClick() {
    if (isLocalDashboard && refreshState !== 'waiting') {
      handleLoginRefresh();
    } else {
      confirmLoginNow();
    }
  }

  const btnLabel = refreshState === 'loading' ? 'Opening…'
    : refreshState === 'checking' ? 'Checking…'
    : refreshState === 'waiting' && isLocalDashboard ? 'Check Login'
    : refreshState === 'done' ? 'Connected ✓'
    : refreshState === 'error' ? 'Retry'
    : isLocalDashboard ? 'Open Login'
    : 'Check Auth';

  const btnColor = refreshState === 'done' ? '#16A34A'
    : refreshState === 'error' ? '#DC2626'
    : '#B45309';

  const isBtnDisabled = refreshState === 'loading' || refreshState === 'checking';
  const showAuthAction = authInfo.status !== 'ok';
  const tone = feedbackTone(refreshState, authInfo.status);

  return (
    <div className="mb-2.5">
      <div
        className="flex items-center justify-between rounded-lg px-[9px] py-[5px]"
        style={{ background: bg, border: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-[5px] min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: dotColor }}
          />
          <span className="text-[10px] font-bold" style={{ color: textColor }}>
            FieldRoutes: {label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {authInfo.lastCheckFormatted && (
            <span className="text-[9px] text-slate-400 hidden sm:inline">
              checked {authInfo.lastCheckFormatted}
            </span>
          )}
          {showAuthAction && (
            <button
              type="button"
              onClick={handleAuthButtonClick}
              disabled={isBtnDisabled}
              aria-busy={isBtnDisabled}
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

      {feedback && (
        <div
          className={`route-auth-feedback route-auth-feedback--${tone} mt-1.5 rounded-[7px] px-[9px] py-[5px]`}
          role="status"
          aria-live="polite"
        >
          <span className="text-[9px] leading-snug">{feedback}</span>
        </div>
      )}

      {isFailed && authInfo.message && !feedback.includes(authInfo.message) && (
        <div className="mt-1.5 rounded-[7px] border border-gs-danger/20 bg-gs-danger/[0.04] px-[9px] py-[5px]">
          <span className="text-[9px] text-gs-danger">{authInfo.message}</span>
        </div>
      )}
    </div>
  );
}

export default AuthStatusBanner;
