import { useEffect, useMemo, useRef, useState } from 'react';
import './login.css';

const FEATURE_CHIPS = [
  'Sales Coach',
  'Route Finder',
  'Replies',
  'Agreements',
  'Knowledge Base',
  'Error Center',
  'Analytics',
];

const SEQUENCE_STEPS = [
  { label: 'Authenticating',           ms: 80 },
  { label: 'Identity verified',        ms: 90 },
  { label: 'Loading CRM modules',      ms: 110 },
  { label: 'Initializing Sales Coach', ms: 100 },
  { label: 'Connecting Route Finder',  ms: 110 },
  { label: 'Loading Knowledge Base',   ms: 100 },
  { label: 'Starting Error Center',    ms: 90 },
  { label: 'Ready',                    ms: 120 },
];

const REMEMBER_KEY = 'gs.auth.remember.username';

export default function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => {
    try { return Boolean(localStorage.getItem(REMEMBER_KEY)); } catch { return false; }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  // Auth sequence overlay state.
  const [sequenceActive, setSequenceActive] = useState(false);
  const [sequenceIndex, setSequenceIndex] = useState(-1);

  const usernameRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    // Skip autofocus when prefilled — user may want to land on password.
    if (!username) usernameRef.current?.focus();
    else document.getElementById('login-password')?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer-driven lighting on the glass card (skipped under reduced motion).
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    function onMove(e) {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--gx', `${x}%`);
      card.style.setProperty('--gy', `${y}%`);
    }
    function onLeave() {
      card.style.setProperty('--gx', `50%`);
      card.style.setProperty('--gy', `0%`);
    }
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    return () => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  async function runSequence() {
    setSequenceActive(true);
    setSequenceIndex(-1);
    for (let i = 0; i < SEQUENCE_STEPS.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, SEQUENCE_STEPS[i].ms));
      setSequenceIndex(i);
    }
    await new Promise((r) => setTimeout(r, 180));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 429
          ? (data.error || 'Too many attempts. Please wait a moment and try again.')
          : (data.error || 'Invalid username or password.');
        setError(msg);
        setSubmitting(false);
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, username.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* private mode etc. */ }

      // Mark fresh-login so the dashboard plays its staggered entrance once.
      try { sessionStorage.setItem('gs.freshLogin', '1'); } catch {}

      await runSequence();
      onAuthenticated?.({ username: data?.user?.username || username.trim() });
    } catch (err) {
      setError('Connection failed. Check your network and try again.');
      setSubmitting(false);
    }
  }

  const sequenceVisible = sequenceActive;

  return (
    <div className="login-root" aria-busy={sequenceActive}>
      <BackgroundField />

      <header className="login-topbar">
        <div className="login-brandmark">
          <ShieldMark size={22} />
          <span>Green Shield</span>
          <span className="login-brandmark__pipe" aria-hidden="true" />
          <span className="login-brandmark__sub">Control Center</span>
        </div>
        <div className="login-status">
          <span className="login-status__dot" aria-hidden="true" />
          <span>All systems operational</span>
        </div>
      </header>

      <main className="login-shell">
        <section className="login-brand" aria-labelledby="login-brand-title">
          <span className="login-eyebrow">
            <span className="login-eyebrow__line" aria-hidden="true" />
            Enterprise CRM · v2026
          </span>

          <h1 id="login-brand-title" className="login-brand__title">
            Green Shield
            <span className="login-brand__title-accent"> Control Center</span>
          </h1>

          <p className="login-brand__lede">
            AI-powered operations platform for pest control sales, routing,
            customer management, scheduling, agreements, and business intelligence.
          </p>

          <ul className="login-chips" aria-label="Included modules">
            {FEATURE_CHIPS.map((label) => (
              <li key={label} className="login-chip">
                <CheckIcon />
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <DashboardPreview />
        </section>

        <section className="login-card-wrap" aria-labelledby="login-card-title">
          <form
            ref={cardRef}
            className="login-card"
            onSubmit={handleSubmit}
            noValidate
            data-transitioning={sequenceVisible ? 'true' : 'false'}
          >
            <div className="login-card__halo" aria-hidden="true" />
            <div className="login-card__inner">
              <header className="login-card__header">
                <div className="login-card__pill">
                  <span className="login-card__pill-dot" aria-hidden="true" />
                  Secure access
                </div>
                <h2 id="login-card-title" className="login-card__title">Sign in</h2>
                <p className="login-card__sub">
                  Authorized internal users only. Sessions are encrypted end-to-end.
                </p>
              </header>

              <div className="login-field">
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  ref={usernameRef}
                  type="text"
                  autoComplete="username"
                  spellCheck="false"
                  autoCapitalize="off"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="login-field">
                <div className="login-field__row">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="login-link"
                    onClick={() => setShowForgot(true)}
                    tabIndex={0}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="login-field__password">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    disabled={submitting}
                    required
                  />
                  <button
                    type="button"
                    className="login-field__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="login-row">
                <label className="login-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={submitting}
                  />
                  <span className="login-check__box" aria-hidden="true">
                    <CheckSmall />
                  </span>
                  <span>Remember me</span>
                </label>
              </div>

              <div className={`login-error ${error ? 'is-visible' : ''}`} role="alert" aria-live="polite">
                {error && (
                  <>
                    <span className="login-error__icon" aria-hidden="true">!</span>
                    <span>{error}</span>
                  </>
                )}
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={submitting || !username || !password}
              >
                <span className="login-submit__ripple" aria-hidden="true" />
                {submitting && !sequenceActive ? (
                  <>
                    <Spinner />
                    <span>Verifying</span>
                  </>
                ) : (
                  <>
                    <LockIcon />
                    <span>Secure Sign In</span>
                  </>
                )}
              </button>

              <div className="login-card__note">
                <ShieldOutline />
                <span>Protected internal access · TLS 1.3 · SSO-compatible workspace</span>
              </div>
            </div>
          </form>

          {sequenceVisible && (
            <AuthSequence index={sequenceIndex} steps={SEQUENCE_STEPS} />
          )}
        </section>
      </main>

      <footer className="login-footer">
        <span>© Green Shield Pest Solutions</span>
        <span className="login-footer__sep" aria-hidden="true">·</span>
        <span>Internal control plane</span>
        <span className="login-footer__sep" aria-hidden="true">·</span>
        <span>Build 2026.6</span>
      </footer>

      {showForgot && (
        <ForgotPasswordDialog onClose={() => setShowForgot(false)} />
      )}
    </div>
  );
}

/* -----------------------------------------------------------
   Background
   ----------------------------------------------------------- */
function BackgroundField() {
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 7) * 1.4}s`,
        duration: `${14 + (i % 5) * 3}s`,
        size: `${2 + (i % 3)}px`,
      })),
    [],
  );

  return (
    <div className="login-bg" aria-hidden="true">
      <div className="login-bg__base" />
      <div className="login-bg__grid" />
      <div className="login-bg__grid login-bg__grid--minor" />
      <div className="login-bg__glow login-bg__glow--a" />
      <div className="login-bg__glow login-bg__glow--b" />
      <div className="login-bg__glow login-bg__glow--c" />
      <div className="login-bg__rays" />
      <div className="login-bg__particles">
        {particles.map((p) => (
          <span
            key={p.id}
            className="login-bg__particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>
      <div className="login-bg__noise" />
      <div className="login-bg__vignette" />
    </div>
  );
}

/* -----------------------------------------------------------
   Blurred decorative dashboard preview
   Pure decoration — non-interactive, aria-hidden.
   ----------------------------------------------------------- */
function DashboardPreview() {
  return (
    <div className="login-preview" aria-hidden="true">
      <div className="login-preview__chrome">
        <div className="login-preview__dots">
          <span /><span /><span />
        </div>
        <div className="login-preview__tab">Control Center · Today</div>
      </div>
      <div className="login-preview__grid">
        <div className="login-preview__card login-preview__card--kpi">
          <div className="lp-label">Pipeline</div>
          <div className="lp-value">$184.2k</div>
          <div className="lp-trend up">+12.4%</div>
          <div className="lp-spark"><Spark seed={1} /></div>
        </div>
        <div className="login-preview__card login-preview__card--kpi">
          <div className="lp-label">Routes today</div>
          <div className="lp-value">37</div>
          <div className="lp-trend up">+4</div>
          <div className="lp-spark"><Spark seed={2} /></div>
        </div>
        <div className="login-preview__card login-preview__card--kpi">
          <div className="lp-label">Reply SLA</div>
          <div className="lp-value">2m 41s</div>
          <div className="lp-trend down">-18s</div>
          <div className="lp-spark"><Spark seed={3} /></div>
        </div>

        <div className="login-preview__card login-preview__card--map">
          <div className="lp-card-head">
            <span className="lp-card-title">Route Finder · Portland</span>
            <span className="lp-card-meta">37 stops · 264 mi</span>
          </div>
          <MapPreview />
        </div>

        <div className="login-preview__card login-preview__card--chart">
          <div className="lp-card-head">
            <span className="lp-card-title">Conversion · 30d</span>
            <span className="lp-card-meta">+8.1%</span>
          </div>
          <ChartPreview />
        </div>

        <div className="login-preview__card login-preview__card--feed">
          <div className="lp-card-head">
            <span className="lp-card-title">Replies</span>
            <span className="lp-card-meta">12 unread</span>
          </div>
          <ul className="lp-feed">
            <li><span className="lp-dot lp-dot--green" />Linda C. — "Looks good, let's go"</li>
            <li><span className="lp-dot lp-dot--amber" />Mark T. — quote follow-up</li>
            <li><span className="lp-dot lp-dot--blue" />Priya V. — reschedule Thu</li>
            <li><span className="lp-dot lp-dot--green" />Erik H. — signed agreement</li>
          </ul>
        </div>

        <div className="login-preview__card login-preview__card--activity">
          <div className="lp-card-head">
            <span className="lp-card-title">Activity</span>
            <span className="lp-card-meta">live</span>
          </div>
          <ul className="lp-activity">
            <li><i /><span>Quote sent · 39 Wharf St</span><em>2m</em></li>
            <li><i /><span>Agreement signed · Hines residence</span><em>6m</em></li>
            <li><i /><span>Route re-optimized · South corridor</span><em>11m</em></li>
            <li><i /><span>SMS auto-reply · Tick &amp; Mosquito</span><em>14m</em></li>
          </ul>
        </div>
      </div>
      <div className="login-preview__veil" />
    </div>
  );
}

function MapPreview() {
  return (
    <svg viewBox="0 0 240 120" className="lp-map" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lpMapBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b2516" />
          <stop offset="100%" stopColor="#04130a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="240" height="120" fill="url(#lpMapBg)" />
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={`h${i}`} x1="0" x2="240" y1={i * 17 + 4} y2={i * 17 + 4} stroke="rgba(74,222,128,0.06)" />
      ))}
      {Array.from({ length: 13 }).map((_, i) => (
        <line key={`v${i}`} y1="0" y2="120" x1={i * 19 + 4} x2={i * 19 + 4} stroke="rgba(74,222,128,0.06)" />
      ))}
      <path d="M10 96 C 50 60, 80 90, 120 50 S 200 30, 230 18" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M10 96 C 50 60, 80 90, 120 50 S 200 30, 230 18" stroke="#4ade80" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.18" />
      {[
        [12, 96], [54, 73], [84, 81], [120, 50], [156, 42], [196, 28], [228, 18],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="3.5" fill="#06170a" stroke="#4ade80" strokeWidth="1.4" />
          <circle cx={x} cy={y} r="9" fill="#4ade80" opacity="0.08" />
        </g>
      ))}
    </svg>
  );
}

function ChartPreview() {
  return (
    <svg viewBox="0 0 240 110" className="lp-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lpArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 80 L20 70 L40 78 L60 60 L80 65 L100 48 L120 52 L140 38 L160 42 L180 28 L200 32 L220 18 L240 22 L240 110 L0 110 Z"
        fill="url(#lpArea)"
      />
      <path
        d="M0 80 L20 70 L40 78 L60 60 L80 65 L100 48 L120 52 L140 38 L160 42 L180 28 L200 32 L220 18 L240 22"
        stroke="#4ade80" strokeWidth="1.6" fill="none" strokeLinecap="round"
      />
      {[20, 60, 100, 140, 180, 220].map((x, i) => (
        <line key={i} x1={x} x2={x} y1="0" y2="110" stroke="rgba(74,222,128,0.05)" />
      ))}
    </svg>
  );
}

function Spark({ seed = 1 }) {
  const path = seed === 1
    ? 'M0 12 L8 9 L16 11 L24 6 L32 7 L40 4 L48 5 L56 2'
    : seed === 2
      ? 'M0 8 L8 10 L16 7 L24 8 L32 5 L40 7 L48 4 L56 5'
      : 'M0 6 L8 8 L16 5 L24 7 L32 4 L40 5 L48 3 L56 4';
  return (
    <svg viewBox="0 0 56 14" preserveAspectRatio="none" width="100%" height="18">
      <path d={path} stroke="#4ade80" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* -----------------------------------------------------------
   Auth sequence overlay
   ----------------------------------------------------------- */
function AuthSequence({ index, steps }) {
  return (
    <div className="auth-seq" role="status" aria-live="assertive">
      <div className="auth-seq__panel">
        <div className="auth-seq__crest">
          <ShieldMark size={48} pulse />
        </div>
        <div className="auth-seq__title">Entering Control Center</div>
        <ul className="auth-seq__list">
          {steps.map((s, i) => {
            const state = i < index ? 'done' : i === index ? 'active' : 'pending';
            return (
              <li key={s.label} className={`auth-seq__row is-${state}`}>
                <span className="auth-seq__bullet" aria-hidden="true">
                  {state === 'done' ? <CheckSmall /> : state === 'active' ? <Spinner small /> : <span className="auth-seq__dot" />}
                </span>
                <span className="auth-seq__label">{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------
   Forgot password placeholder dialog
   ----------------------------------------------------------- */
function ForgotPasswordDialog({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-forgot-title" onClick={onClose}>
      <div className="login-modal__card" onClick={(e) => e.stopPropagation()}>
        <h3 id="login-forgot-title">Need access?</h3>
        <p>
          Green Shield Control Center is an internal workspace. Reach out to your
          workspace administrator to reset access or provision new credentials.
        </p>
        <button type="button" className="login-modal__btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------
   Icons
   ----------------------------------------------------------- */
function ShieldMark({ size = 22, pulse = false }) {
  return (
    <svg
      className={`login-shield ${pulse ? 'login-shield--pulse' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ls-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#0f9d58" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5L4.5 6.5v9.2c0 7 4.9 12.4 11.5 14.3 6.6-1.9 11.5-7.3 11.5-14.3V6.5L16 2.5z"
        fill="url(#ls-grad)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
      />
      <path
        d="M10.5 16.2l3.6 3.6 7.4-7.4"
        stroke="#06170a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldOutline() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5L9.5 18L20 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckSmall() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5L9.5 18L20 6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.6 6.2C11 6.1 11.5 6 12 6c6.5 0 10 7 10 7-.7 1.4-1.7 2.7-3 3.8M6.7 6.8C4 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.2-.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Spinner({ small = false }) {
  return <span className={`login-spinner ${small ? 'is-small' : ''}`} aria-hidden="true" />;
}
