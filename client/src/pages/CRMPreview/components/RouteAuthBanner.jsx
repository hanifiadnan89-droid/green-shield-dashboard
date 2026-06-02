import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../../api/client.js';

function formatCheckedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const STATUS = {
  ok: {
    label: 'Connected',
    dot: '#16A34A',
    text: '#16A34A',
    bg: 'rgba(22,163,74,0.06)',
    border: 'rgba(22,163,74,0.2)',
  },
  needs_login: {
    label: 'Needs Login',
    dot: '#F59E0B',
    text: '#B45309',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.28)',
  },
  checking: {
    label: 'Refreshing',
    dot: '#94A3B8',
    text: '#64748B',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.22)',
  },
  failed: {
    label: 'Error',
    dot: '#DC2626',
    text: '#DC2626',
    bg: 'rgba(220,38,38,0.06)',
    border: 'rgba(220,38,38,0.22)',
  },
  unknown: {
    label: 'Checking',
    dot: '#94A3B8',
    text: '#64748B',
    bg: 'rgba(148,163,184,0.06)',
    border: 'rgba(148,163,184,0.18)',
  },
};

function AuthStatusBanner({ authInfo, onLoginRefreshStarted }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pasteJson, setPasteJson] = useState('');

  const uiStatus = busy ? 'checking' : (authInfo.status || 'unknown');
  const theme = STATUS[uiStatus] || STATUS.unknown;
  const isConnected = !busy && authInfo.status === 'ok';
  const checkedLabel = formatCheckedAt(authInfo.lastCheck);

  const runServerLogin = useCallback(async () => {
    setBusy(true);
    setActionError('');
    try {
      await api.routes.refreshServerAuth();
      const statusData = await onLoginRefreshStarted?.();
      if (statusData?._auth?.status !== 'ok') {
        setActionError(statusData?._auth?.message || 'Could not connect to FieldRoutes. Try again.');
      }
    } catch (err) {
      setActionError(err?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }, [onLoginRefreshStarted]);

  const runRefreshSession = useCallback(async () => {
    setBusy(true);
    setActionError('');
    try {
      const check = await api.routes.authCheck(true);
      if (check?.status !== 'ok' && check?.result !== 'ok') {
        setActionError(check?.message || 'Session is no longer valid. Use Log Back In.');
        return;
      }
      await onLoginRefreshStarted?.();
    } catch (err) {
      setActionError(err?.message || 'Refresh failed.');
    } finally {
      setBusy(false);
    }
  }, [onLoginRefreshStarted]);

  const handlePrimary = () => {
    if (busy) return;
    if (isConnected) runRefreshSession();
    else runServerLogin();
  };

  async function handleApplyPastedAuth() {
    const raw = pasteJson.trim();
    if (!raw) return;
    setBusy(true);
    setActionError('');
    try {
      await api.routes.applyAuthState({ raw });
      await onLoginRefreshStarted?.();
      setPasteJson('');
      setShowAdvanced(false);
    } catch (err) {
      setActionError(err?.message || 'Could not apply session.');
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = busy
    ? 'Refreshing…'
    : isConnected
      ? 'Refresh'
      : 'Log Back In';

  return (
    <div className="route-auth-bar mb-0">
      <div
        className="route-auth-bar__row"
        style={{ background: theme.bg, borderColor: theme.border }}
      >
        <div className="route-auth-bar__status min-w-0">
          <span className="route-auth-bar__dot" style={{ background: theme.dot }} aria-hidden />
          <span className="route-auth-bar__label" style={{ color: theme.text }}>
            FieldRoutes: {theme.label}
          </span>
          {checkedLabel && !busy && (
            <span className="route-auth-bar__meta hidden sm:inline">
              · {checkedLabel}
            </span>
          )}
        </div>

        <motion.button
          type="button"
          onClick={handlePrimary}
          disabled={busy}
          className={[
            'route-auth-bar__btn',
            !isConnected && !busy ? 'route-auth-bar__btn--warn' : '',
          ].filter(Boolean).join(' ')}
          whileHover={busy ? undefined : { scale: 1.02 }}
          whileTap={busy ? undefined : { scale: 0.96 }}
          aria-busy={busy}
        >
          {busy && <Loader2 size={12} className="animate-spin shrink-0" aria-hidden />}
          {buttonLabel}
        </motion.button>
      </div>

      {actionError && (
        <p className="route-auth-bar__error" role="alert">
          {actionError}
        </p>
      )}

      {!isConnected && !busy && (
        <button
          type="button"
          className="route-auth-bar__advanced-toggle"
          onClick={() => setShowAdvanced(v => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced'}
        </button>
      )}

      {showAdvanced && (
        <div className="route-auth-bar__advanced">
          <label className="route-auth-bar__advanced-label">
            Emergency session JSON
            <textarea
              className="route-auth-bar__advanced-input"
              rows={3}
              value={pasteJson}
              onChange={e => setPasteJson(e.target.value)}
              placeholder='{"cookies":[...]}'
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="route-auth-bar__btn route-auth-bar__btn--secondary"
            disabled={busy || !pasteJson.trim()}
            onClick={handleApplyPastedAuth}
          >
            Apply session
          </button>
        </div>
      )}
    </div>
  );
}

export default AuthStatusBanner;
