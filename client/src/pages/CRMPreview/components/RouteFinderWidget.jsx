import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MapPin, Search, Loader2, CheckCircle, AlertCircle, RotateCcw, Navigation, RefreshCw } from 'lucide-react';
import { api } from '../../../api/client.js';
import { scoreRoutes, detectRouteArea } from '../../../utils/fieldRoutesScorer.js';

// ---------------------------------------------------------------------------
// Time slot configuration
// ---------------------------------------------------------------------------
const TIME_PREFS = [
  { key: 'AM', label: 'AM', sub: '8am – 12pm' },
  { key: 'PM', label: 'PM', sub: '12pm – 6pm' },
  { key: 'specific', label: 'Specific', sub: 'choose slot' },
];

const FOUR_HOUR_SLOTS = [
  { key: '8-12',  label: '8am – 12pm' },
  { key: '12-4',  label: '12pm – 4pm' },
];

const TWO_HOUR_SLOTS = [
  { key: '8-10',  label: '8 – 10am' },
  { key: '10-12', label: '10am – 12pm' },
  { key: '12-2',  label: '12 – 2pm' },
  { key: '2-4',   label: '2 – 4pm' },
  { key: '4-6',   label: '4 – 6pm' },
];

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------
function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function buildDateMetas() {
  const metas = [];
  let offset = 0;
  while (metas.length < 6) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (d.getDay() !== 0) { // skip Sunday
      const key = getLocalDateStr(offset);
      const label = offset === 0 ? 'Today'
        : offset === 1 ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      metas.push({ key, label });
    }
    offset++;
  }
  return metas;
}

// ---------------------------------------------------------------------------
// Status badge for each date pill
// ---------------------------------------------------------------------------
const STATUS_CFG = {
  cached:         { label: 'Cached',  color: '#16A34A' },
  refreshing:     { label: 'Loading', color: '#3B82F6', spinning: true },
  failed:         { label: 'Failed',  color: '#DC2626', showRefresh: true },
  needs_login:    { label: 'Login',   color: '#F59E0B', showRefresh: true },
  missing:        { label: '—',       color: '#94A3B8', showRefresh: true },
  not_configured: { label: '—',       color: '#CBD5E1' },
};

function fmtAgo(isoStr) {
  if (!isoStr) return null;
  const ageMin = Math.round((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (ageMin < 1)    return 'just now';
  if (ageMin < 60)   return `${ageMin}m ago`;
  if (ageMin < 1440) return `${Math.floor(ageMin / 60)}h ago`;
  return `${Math.floor(ageMin / 1440)}d ago`;
}

function StatusBadge({ status, meta, date, onRefresh }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.missing;
  const ago = status === 'cached' ? fmtAgo(meta?.timestamp) : null;
  return (
    <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 14 }}>
      {cfg.spinning
        ? <Loader2 size={9} className="animate-spin" style={{ color: cfg.color }} />
        : <span style={{ fontSize: 9, color: cfg.color, fontWeight: 600 }}>{cfg.label}{ago ? ` · ${ago}` : ''}</span>
      }
      {cfg.showRefresh && onRefresh && (
        <button
          onClick={() => onRefresh(date)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94A3B8', lineHeight: 1 }}
          title="Refresh"
        >
          <RefreshCw size={9} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nominatim geocoder
// ---------------------------------------------------------------------------
async function nominatimGeocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'GreenShieldDashboard/1.0' } });
  if (!resp.ok) throw new Error('Geocoding service unavailable');
  const data = await resp.json();
  if (!data.length) throw new Error('Address not found');
  const { lat, lon, display_name } = data[0];
  const parts = display_name.split(',').map(s => s.trim());
  const short = parts.slice(0, 3).join(', ');
  return { lat: parseFloat(lat), lng: parseFloat(lon), display: short, full: display_name };
}

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------
function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = score >= 70 ? '#16A34A' : score >= 45 ? '#F59E0B' : '#94A3B8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------
const ROUTE_AREA_LABELS = {
  new_hampshire: 'New Hampshire Route',
  maine:         'Maine Route',
};

const TIMED_RISK_CFG = {
  none:   { label: '✓ timed safe',    color: '#16A34A' },
  low:    { label: '⚡ low risk',      color: '#F59E0B' },
  medium: { label: '⚠ timed risk',    color: '#F59E0B' },
  high:   { label: '✗ timed conflict', color: '#DC2626' },
};

const SMOOTHNESS_CFG = {
  'Smooth fit':       { color: '#16A34A', icon: '✓' },
  'Minor adjustment': { color: '#F59E0B', icon: '~' },
  'Tight gap':        { color: '#F59E0B', icon: '⚡' },
  'Some disruption':  { color: '#F59E0B', icon: '⚠' },
  'Difficult fit':    { color: '#DC2626', icon: '✗' },
};

const BT_RISK_CFG = {
  'None':     { color: '#16A34A', icon: '✓' },
  'Low':      { color: '#F59E0B', icon: '~' },
  'Moderate': { color: '#F59E0B', icon: '⚠' },
  'High':     { color: '#DC2626', icon: '✗' },
  'Severe':   { color: '#DC2626', icon: '✗' },
};

const CONF_CFG = {
  'High':   { color: '#16A34A' },
  'Medium': { color: '#F59E0B' },
  'Low':    { color: '#94A3B8' },
};

function ResultCard({ match, rank, routeArea }) {
  const rankColors = ['#16A34A', '#3B82F6', '#8B5CF6'];
  const color = rankColors[rank - 1] || '#94A3B8';
  const ins = match.bestInsertion;
  const timedCfg = TIMED_RISK_CFG[ins?.timedRisk] ?? TIMED_RISK_CFG.none;
  const areaLabel = ROUTE_AREA_LABELS[routeArea];
  const smoothCfg = SMOOTHNESS_CFG[match.routeSmoothness] ?? null;
  const timedSafetyColor = ins?.timedRisk === 'high' ? '#DC2626'
    : ins?.timedRisk === 'medium' || ins?.timedRisk === 'low' ? '#F59E0B'
    : '#16A34A';
  const btCfg   = BT_RISK_CFG[ins?.backtrackingRisk] ?? BT_RISK_CFG['None'];
  const confCfg = CONF_CFG[ins?.optimizationConfidence] ?? CONF_CFG['Low'];
  const clusterLabel = match.clusterDetail?.label || match.clusterLabel;

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${rank === 1 ? 'rgba(22,163,74,0.25)' : 'rgba(0,0,0,0.07)'}`,
      background: rank === 1 ? 'rgba(22,163,74,0.04)' : '#fff',
      padding: '10px 12px',
      marginBottom: 8,
    }}>
      {/* Route area badge */}
      {areaLabel && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            color: routeArea === 'new_hampshire' ? '#3B82F6' : '#8B5CF6',
            background: routeArea === 'new_hampshire' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
            borderRadius: 4, padding: '1px 5px',
          }}>
            Route Area: {areaLabel}
          </span>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', background: color,
          color: '#fff', fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {match.techName}
            </p>
            {match.wasOptimized && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.08)', borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                optimized
              </span>
            )}
            {ins?.optimizationConfidence && (
              <span style={{ fontSize: 8, fontWeight: 600, color: confCfg.color, flexShrink: 0 }}
                    title={`Optimization confidence: ${ins.optimizationConfidence}`}>
                {ins.optimizationConfidence} conf
              </span>
            )}
          </div>
          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>
            Route {match.routeId} · {match.stopCount} stops · {match.nearestStopMiles} mi away
            {match.clusterDensity > 0 && (
              <span style={{ color: '#16A34A', fontWeight: 600, marginLeft: 4 }}>
                · {match.clusterDensity} nearby
              </span>
            )}
          </p>
        </div>
        {smoothCfg && (
          <span style={{ fontSize: 9, fontWeight: 700, color: smoothCfg.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {smoothCfg.icon} {match.routeSmoothness}
          </span>
        )}
      </div>

      {/* Suggested window */}
      {ins?.suggestedWindow && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: rank === 1 ? '#16A34A' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {rank === 1 ? 'Recommended: ' : 'Suggested: '}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>
            {ins.suggestedWindow}
          </span>
          <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 5 }}>
            (arrives {ins.estimatedArrivalTime})
          </span>
        </div>
      )}

      <ScoreBar score={match.scores.total} />

      {/* Insertion path */}
      {ins && (ins.prevStop || ins.nextStop) && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {ins.prevStop && (
            <span title={ins.insertAfterLabel || ins.prevStop.scheduledArrival}>{ins.prevStop.customerName}</span>
          )}
          {ins.prevStop && <span style={{ color: '#CBD5E1' }}>→</span>}
          <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NEW</span>
          {ins.nextStop && <span style={{ color: '#CBD5E1' }}>→</span>}
          {ins.nextStop && (
            <span title={ins.insertBeforeLabel || (ins.nextStop.isTimed ? `Timed: ${ins.nextStop.windowLabel}` : ins.nextStop.scheduledArrival)}>
              {ins.nextStop.customerName}
              {ins.nextStop.isTimed && <span style={{ color: '#F59E0B', marginLeft: 2 }}>⏱</span>}
            </span>
          )}
        </div>
      )}

      {/* Geo context: insertion position + closest stop + cluster */}
      {ins && (
        <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ins.insertionPositionLabel && (
            <span style={{ fontSize: 9, color: '#94A3B8' }}>
              <span style={{ fontWeight: 600, color: '#64748B' }}>Position</span> {ins.insertionPositionLabel}
            </span>
          )}
          {match.closestStop && (
            <span style={{ fontSize: 9, color: '#94A3B8' }}>
              <span style={{ fontWeight: 600, color: '#64748B' }}>Closest stop</span>{' '}
              {match.closestStop.customerName ?? match.closestStop.address} · {match.closestStop.distanceMiles} mi
              {match.closestStop.scheduledTime ? ` · ${match.closestStop.scheduledTime}` : ''}
              {' '}(stop {match.closestStop.stopIndex})
            </span>
          )}
          {clusterLabel && (
            <span style={{ fontSize: 9, fontWeight: 600, color: match.clusterDensity >= 3 ? '#16A34A' : match.clusterDensity >= 1 ? '#F59E0B' : '#94A3B8' }}>
              {match.clusterDensity >= 3 ? '✓ ' : match.clusterDensity >= 1 ? '~ ' : ''}{clusterLabel}
            </span>
          )}
        </div>
      )}

      {/* Stats row */}
      {ins && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>+Drive</span> {ins.addedDriveTime}
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>+Miles</span> {ins.detourMiles} mi
          </span>
          {ins.serviceDuration && (
            <span style={{ fontSize: 10, color: '#475569' }}>
              <span style={{ fontWeight: 600 }}>Service</span> {ins.serviceDuration}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Cap</span> {match.capacity.remainingHours}h left
          </span>
          {!ins.viable && (
            <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>⚠ tight gap</span>
          )}
        </div>
      )}

      {/* Backtracking risk */}
      {ins?.backtrackingRisk && ins.backtrackingRisk !== 'None' && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: btCfg.color }}>
            {btCfg.icon} Backtracking:
          </span>{' '}
          <span style={{ fontSize: 10, color: btCfg.color }}>
            {ins.backtrackingRisk}
            {ins.backtrackingDetail ? ` — ${ins.backtrackingDetail}` : ''}
          </span>
        </div>
      )}
      {ins?.backtrackingRisk === 'None' && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#16A34A' }}>✓ Backtracking:</span>{' '}
          <span style={{ fontSize: 10, color: '#16A34A' }}>None</span>
        </div>
      )}

      {/* Timed appointment safety */}
      {ins?.timedSafetyLabel && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: timedSafetyColor }}>
            {ins.timedRisk === 'none' ? '✓' : ins.timedRisk === 'high' ? '✗' : '⚠'} Timed appts:
          </span>{' '}
          <span style={{ fontSize: 10, color: timedSafetyColor }}>{ins.timedSafetyLabel}</span>
        </div>
      )}

      {/* End-of-day safety */}
      {ins?.eodLabel && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: ins.eodSafe !== false ? '#16A34A' : '#DC2626' }}>
            {ins.eodSafe !== false ? '✓' : '✗'} End of day:
          </span>{' '}
          <span style={{ fontSize: 10, color: ins.eodSafe !== false ? '#16A34A' : '#DC2626' }}>{ins.eodLabel}</span>
        </div>
      )}

      {/* Start/end location fit */}
      {ins?.startEndLocationFit && !ins.startEndLocationFit.startsWith('Neutral') && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#3B82F6' }}>◎ Location fit:</span>{' '}
          <span style={{ fontSize: 10, color: '#475569' }}>{ins.startEndLocationFit}</span>
        </div>
      )}

      {/* Reason */}
      {match.reason && (
        <p style={{ fontSize: 10, color: '#64748B', margin: '5px 0 0', lineHeight: 1.4 }}>
          {match.reason}
        </p>
      )}

      {/* Score breakdown */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, paddingTop: 5, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        {['geographic', 'travelEfficiency', 'timeWindow', 'capacity', 'insertionProximity'].map(k => {
          const labels = { geographic: 'Geo', travelEfficiency: 'Drive', timeWindow: 'Win', capacity: 'Cap', insertionProximity: 'Ins' };
          const v = match.scores[k] ?? 0;
          return (
            <div key={k} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: v >= 70 ? '#16A34A' : v >= 45 ? '#F59E0B' : '#CBD5E1' }}>{v}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{labels[k]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth status banner — always mounted, never conditional
// ---------------------------------------------------------------------------
function AuthStatusBanner({ authInfo }) {
  const isChecking = authInfo.status === 'checking';
  const isOk       = authInfo.status === 'ok';
  const isLogin    = authInfo.status === 'needs_login';
  const isFailed   = authInfo.status === 'failed';

  const dotColor  = isChecking ? '#94A3B8' : isOk ? '#16A34A' : isFailed ? '#DC2626' : '#F59E0B';
  const textColor = isChecking ? '#64748B' : isOk ? '#16A34A' : isFailed ? '#DC2626' : '#B45309';
  const bg        = isChecking ? 'rgba(148,163,184,0.06)' : isOk ? 'rgba(22,163,74,0.05)' : isFailed ? 'rgba(220,38,38,0.05)' : 'rgba(245,158,11,0.07)';
  const border    = isChecking ? 'rgba(148,163,184,0.2)' : isOk ? 'rgba(22,163,74,0.18)' : isFailed ? 'rgba(220,38,38,0.18)' : 'rgba(245,158,11,0.28)';
  const label     = isChecking ? 'Checking…' : isOk ? 'Connected' : isLogin ? 'Needs Login' : isFailed ? 'Failed' : 'Unknown';

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
        </div>
      </div>
      {isLogin && (
        <div style={{ marginTop: 5, padding: '6px 9px', borderRadius: 7, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#B45309', margin: '0 0 3px' }}>
            ⚠ Session expired — re-run the login script:
          </p>
          <code style={{ fontSize: 9, color: '#475569', background: 'rgba(0,0,0,0.05)', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', lineHeight: 1.6 }}>
            cd ~/green-shield-dashboard && node scripts/fieldRoutesLogin.mjs
          </code>
        </div>
      )}
      {isFailed && authInfo.message && (
        <div style={{ marginTop: 5, padding: '5px 9px', borderRadius: 7, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.18)' }}>
          <span style={{ fontSize: 9, color: '#DC2626' }}>{authInfo.message}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------
export default function RouteFinderWidget() {
  // Date selection
  const DATE_METAS = useMemo(() => buildDateMetas(), []);
  const DATE_KEYS  = useMemo(() => DATE_METAS.map(d => d.key), [DATE_METAS]);

  const [activeDate, setActiveDate]           = useState(null);
  const [dateStatus, setDateStatus]           = useState({});
  const [authInfo, setAuthInfo]               = useState({ status: 'checking' });
  const [activeTechnicians, setActiveTechnicians] = useState(null);
  const [dateLoadStatus, setDateLoadStatus]   = useState('idle'); // idle|loading|error

  // Address
  const [addressInput, setAddressInput]   = useState('');
  const [geocode, setGeocode]             = useState(null);
  const [geocodeStatus, setGeocodeStatus] = useState('idle');
  const [geocodeError, setGeocodeError]   = useState('');
  const [isEditing, setIsEditing]         = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions]         = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  // Time preference
  const [timePref, setTimePref]         = useState(null);
  const [specificSlot, setSpecificSlot] = useState(null);
  const [specialNotes, setSpecialNotes] = useState('');

  // Time preference override ("Other" panel)
  const [showOther, setShowOther]         = useState(false);

  // Scoring
  const [scoringStatus, setScoringStatus] = useState('idle');
  const [scoringError, setScoringError]   = useState('');
  const [results, setResults]             = useState(null);

  const geocodeCacheRef    = useRef({});
  const suggestDebounceRef = useRef(null);
  const suppressBlurRef    = useRef(false);
  const pollRef            = useRef(null);
  const bgStatusRef        = useRef(null);
  const dateKeysRef     = useRef(DATE_KEYS);
  useEffect(() => { dateKeysRef.current = DATE_KEYS; }, [DATE_KEYS]);
  const activeDateRef   = useRef(activeDate);
  useEffect(() => { activeDateRef.current = activeDate; }, [activeDate]);

  // ---------------------------------------------------------------------------
  // Helper: splits _auth out of the status response and applies both
  // ---------------------------------------------------------------------------
  const applyStatusData = useCallback((statusData) => {
    const { _auth, ...dateStatuses } = statusData;
    setDateStatus(dateStatuses);
    if (_auth) setAuthInfo(_auth);
  }, []);

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const statusData = await api.routes.status();
        applyStatusData(statusData);
        const anyRefreshing = dateKeysRef.current.some(d => statusData[d]?.status === 'refreshing');
        if (!anyRefreshing) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
  }, [applyStatusData]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // 30-second background status refresh — updates date pills + auth status
  useEffect(() => {
    bgStatusRef.current = setInterval(async () => {
      if (pollRef.current) return; // active polling already running
      try {
        const statusData = await api.routes.status();
        applyStatusData(statusData);
      } catch { /* ignore */ }
    }, 30000);
    return () => { if (bgStatusRef.current) clearInterval(bgStatusRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // On mount: load status, trigger preload for missing dates
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const statusData = await api.routes.status();
        applyStatusData(statusData);
        const needsLoad = DATE_KEYS.some(d => {
          const s = statusData[d]?.status;
          return !s || s === 'missing';
        });
        if (needsLoad) {
          api.routes.preload().catch(() => {});
          // Optimistically mark missing dates as refreshing (auth-aware)
          const auth = statusData._auth;
          if (!auth || auth.status === 'ok' || auth.status === 'unknown') {
            setDateStatus(prev => {
              const next = { ...prev };
              DATE_KEYS.forEach(d => {
                if (!next[d] || next[d].status === 'missing') {
                  next[d] = { status: 'refreshing' };
                }
              });
              return next;
            });
            startPolling();
          }
        } else {
          const anyRefreshing = DATE_KEYS.some(d => statusData[d]?.status === 'refreshing');
          if (anyRefreshing) startPolling();
        }
      } catch {
        // Server not available — widget still works when routes are offline
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Date selection
  // ---------------------------------------------------------------------------
  const handleDateSelect = useCallback(async (date) => {
    setActiveDate(date);
    setActiveTechnicians(null);
    setResults(null);
    setScoringStatus('idle');
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);

    setDateLoadStatus('loading');
    try {
      const data = await api.routes.payload(date);
      setActiveTechnicians(data.technicians || []);
      setDateLoadStatus('idle');
    } catch (err) {
      setDateLoadStatus('error');
      setActiveTechnicians(null);
      console.warn('[RouteFinderWidget] payload load failed:', err.message);
    }
  }, []);

  const handleRefresh = useCallback(async (date) => {
    try {
      await api.routes.refresh(date);
      setDateStatus(prev => ({ ...prev, [date]: { ...(prev[date] || {}), status: 'refreshing' } }));
      if (activeDate === date) {
        setActiveTechnicians(null);
        setResults(null);
        setScoringStatus('idle');
      }
      startPolling();
    } catch { /* ignore */ }
  }, [activeDate, startPolling]);

  const handleRefreshAll = useCallback(async () => {
    try {
      await api.routes.preload(true); // force=true — always re-scrape, ignore cache age
      setDateStatus(prev => {
        const next = { ...prev };
        DATE_KEYS.forEach(d => { next[d] = { ...(next[d] || {}), status: 'refreshing' }; });
        return next;
      });
      startPolling();
    } catch { /* ignore */ }
  }, [DATE_KEYS, startPolling]);

  // ---------------------------------------------------------------------------
  // Address autocomplete
  // ---------------------------------------------------------------------------
  const fetchSuggestions = useCallback(async (query) => {
    if (query.trim().length < 4) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      // Bias toward ME/NH area (bounded=0 allows results outside viewport too)
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=us&addressdetails=1&viewbox=-73.0,42.5,-69.5,47.5&bounded=0`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'GreenShieldDashboard/1.0' } });
      if (!resp.ok) return;
      const data = await resp.json();
      const formatted = data.map(item => {
        const a = item.address || {};
        const streetNum = a.house_number || '';
        const street    = a.road || a.pedestrian || a.path || '';
        const primary   = [streetNum, street].filter(Boolean).join(' ') ||
                          item.display_name.split(',')[0].trim();
        const city  = a.city || a.town || a.village || a.hamlet || '';
        const state = a.state || '';
        const zip   = a.postcode || '';
        const secondary = [city, [state, zip].filter(Boolean).join(' ')]
                            .filter(Boolean).join(', ');
        const shortDisplay = [primary, secondary].filter(Boolean).join(', ');
        return { primary, secondary, shortDisplay, full: item.display_name,
                 lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
      }).filter(s => s.primary);
      setSuggestions(formatted);
      setShowSuggestions(formatted.length > 0);
      setActiveSuggestion(-1);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const selectSuggestion = useCallback((s) => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    setAddressInput(s.shortDisplay);
    // Use coordinates directly from the suggestion — no second geocode call needed
    const result = { lat: s.lat, lng: s.lng, display: s.shortDisplay, full: s.full };
    geocodeCacheRef.current[s.shortDisplay] = result;
    setGeocode(result);
    setGeocodeStatus('success');
    setResults(null);
    setScoringStatus('idle');
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);
    setIsEditing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Geocode
  // ---------------------------------------------------------------------------
  const doGeocode = useCallback(async (addr) => {
    const trimmed = addr.trim();
    if (!trimmed) return;
    if (geocodeCacheRef.current[trimmed]) {
      setGeocode(geocodeCacheRef.current[trimmed]);
      setGeocodeStatus('success');
      setResults(null);
      setScoringStatus('idle');
      setTimePref(null);
      setSpecificSlot(null);
      setShowOther(false);
      setIsEditing(false);
      return;
    }
    setGeocodeStatus('loading');
    setGeocodeError('');
    setResults(null);
    setScoringStatus('idle');
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);
    try {
      const result = await nominatimGeocode(trimmed);
      geocodeCacheRef.current[trimmed] = result;
      setGeocode(result);
      setGeocodeStatus('success');
      setIsEditing(false);
    } catch (err) {
      setGeocodeStatus('error');
      setGeocodeError(err.message);
    }
  }, []);

  const handleAddressKey = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion(prev => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Enter' && activeSuggestion >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestion]);
        return;
      }
      if (e.key === 'Escape') {
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveSuggestion(-1);
        return;
      }
    }
    if (e.key === 'Enter') doGeocode(addressInput);
  };

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------
  const runScore = useCallback(async (techList, latLng, prefStr = 'AT') => {
    if (!techList?.length || !latLng) return;
    setScoringStatus('loading');
    setScoringError('');
    try {
      const routeArea = detectRouteArea(latLng.full || '');
      const lead = {
        lat: latLng.lat,
        lng: latLng.lng,
        serviceType: 'Regular Service',
        durationMinutes: 30,
        timeWindowPreference: prefStr || 'AT',
        routeArea,
        date: activeDateRef.current,
      };
      const scored = scoreRoutes(techList, lead, 3);
      setResults(scored);
      setScoringStatus('done');
    } catch (err) {
      setScoringStatus('error');
      setScoringError(err.message || 'Scoring failed');
    }
  }, []);

  const handleTimePrefSelect = useCallback((key) => {
    setTimePref(key);
    setSpecificSlot(null);
    if (key !== 'specific' && geocode && activeTechnicians?.length) {
      runScore(activeTechnicians, geocode, key);
    }
  }, [geocode, activeTechnicians, runScore]);

  const handleSpecificSlotSelect = useCallback((slot) => {
    setSpecificSlot(slot);
    if (geocode && activeTechnicians?.length) {
      runScore(activeTechnicians, geocode, slot);
    }
  }, [geocode, activeTechnicians, runScore]);

  // ---------------------------------------------------------------------------
  // Auto-score when both geocode + technicians are ready
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!geocode || !activeTechnicians?.length) return;
    runScore(activeTechnicians, geocode, 'AT');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocode, activeTechnicians]);

  const handleReset = () => {
    setAddressInput('');
    setGeocode(null);
    setGeocodeStatus('idle');
    setGeocodeError('');
    setIsEditing(false);
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);
    setSpecialNotes('');
    setResults(null);
    setScoringStatus('idle');
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-card section-enter flex flex-col h-full">
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Navigation size={14} style={{ color: '#16A34A' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1 }}>Route Finder</h3>
            <p style={{ fontSize: 10, color: '#94A3B8', margin: 0, marginTop: 2 }}>Find best technician for a new stop</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={handleRefreshAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
            title="Refresh all dates"
          >
            <RefreshCw size={13} />
          </button>
          {(geocode || results) && (
            <button
              onClick={handleReset}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* ── FieldRoutes auth status ── */}
        <AuthStatusBanner authInfo={authInfo} />

        {/* ── Date picker ── */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            Route Date
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DATE_METAS.map(({ key, label }) => {
              const s = dateStatus[key] || { status: 'missing' };
              const isCached = s.status === 'cached';
              const isActive = activeDate === key;
              const isLoading = dateLoadStatus === 'loading' && isActive;

              return (
                <div key={key} style={{ flex: '1 1 calc(33.33% - 4px)', textAlign: 'center' }}>
                  <button
                    onClick={() => isCached && handleDateSelect(key)}
                    style={{
                      width: '100%',
                      padding: '6px 4px',
                      borderRadius: 9,
                      border: `1.5px solid ${isActive ? '#16A34A' : isCached ? 'rgba(22,163,74,0.3)' : 'rgba(0,0,0,0.08)'}`,
                      background: isActive ? '#16A34A' : isCached ? 'rgba(22,163,74,0.04)' : '#f8fafc',
                      cursor: isCached ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    {isLoading && <Loader2 size={9} className="animate-spin" style={{ color: isActive ? '#fff' : '#16A34A' }} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#fff' : isCached ? '#0F172A' : '#94A3B8', lineHeight: 1 }}>
                      {label}
                    </span>
                  </button>
                  <StatusBadge status={s.status} meta={s} date={key} />
                </div>
              );
            })}
          </div>

          {activeDate && activeTechnicians !== null && activeTechnicians.length === 0 && dateLoadStatus !== 'loading' && (
            <p style={{ fontSize: 10, color: '#F59E0B', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> No routes with stops found for this date
            </p>
          )}
          {activeDate && dateLoadStatus === 'error' && (
            <p style={{ fontSize: 10, color: '#DC2626', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> Failed to load route data
            </p>
          )}
        </div>

        {/* ── Address input ── */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            Customer Address
          </label>

          {geocodeStatus === 'success' && !isEditing ? (
            <div style={{
              borderRadius: 10, border: '1px solid rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.04)',
              padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 7,
            }}>
              <CheckCircle size={13} style={{ color: '#16A34A', marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', margin: 0, lineHeight: 1.3 }}>{geocode.display}</p>
                <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0', fontFamily: 'monospace' }}>
                  {geocode.lat.toFixed(5)}, {geocode.lng.toFixed(5)}
                </p>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                style={{ fontSize: 10, color: '#16A34A', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontWeight: 600, flexShrink: 0 }}
              >
                Edit
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <MapPin size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', zIndex: 1 }} />
              <input
                autoFocus={isEditing}
                value={addressInput}
                onChange={e => {
                  const val = e.target.value;
                  setAddressInput(val);
                  setActiveSuggestion(-1);
                  if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
                  if (val.trim().length >= 4) {
                    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
                  } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={handleAddressKey}
                placeholder="Start typing an address…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 36px 8px 28px', borderRadius: 10,
                  border: `1px solid ${geocodeStatus === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.1)'}`,
                  fontSize: 12, color: '#0F172A', background: '#f8fafc', outline: 'none',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(22,163,74,0.4)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)';
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={e => {
                  if (suppressBlurRef.current) { suppressBlurRef.current = false; return; }
                  e.target.style.borderColor = geocodeStatus === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.1)';
                  e.target.style.boxShadow = 'none';
                  setShowSuggestions(false);
                  if (addressInput.trim()) doGeocode(addressInput);
                }}
              />
              {geocodeStatus === 'loading' ? (
                <Loader2 size={12} className="animate-spin" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              ) : (
                <button
                  onClick={() => doGeocode(addressInput)}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#94A3B8', display: 'flex' }}
                >
                  <Search size={12} />
                </button>
              )}

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                  background: '#fff', borderRadius: 10, marginTop: 4,
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                }}>
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      onMouseDown={() => { suppressBlurRef.current = true; selectSuggestion(s); }}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      style={{
                        padding: '7px 11px',
                        cursor: 'pointer',
                        background: i === activeSuggestion ? 'rgba(22,163,74,0.06)' : '#fff',
                        borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        transition: 'background 0.1s',
                      }}
                    >
                      <MapPin size={11} style={{ color: i === activeSuggestion ? '#16A34A' : '#94A3B8', marginTop: 2, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.primary}
                        </p>
                        {s.secondary && (
                          <p style={{ fontSize: 10, color: '#64748B', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.secondary}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {geocodeStatus === 'error' && (
            <p style={{ fontSize: 10, color: '#DC2626', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> {geocodeError} — try a more complete address
            </p>
          )}
          <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Type to see suggestions · press Enter or ↑↓ to navigate</p>
        </div>

        {/* ── Other windows toggle ── */}
        {geocodeStatus === 'success' && (
          <div style={{ marginBottom: showOther ? 0 : 10, display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => {
                const closing = showOther;
                setShowOther(o => !o);
                if (closing) {
                  setTimePref(null);
                  setSpecificSlot(null);
                  if (geocode && activeTechnicians?.length) runScore(activeTechnicians, geocode, 'AT');
                }
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 11, color: '#3B82F6', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              {showOther ? '▴' : '▾'} Other windows
            </button>
          </div>
        )}

        {/* ── Other: timing preference picker ── */}
        {geocodeStatus === 'success' && showOther && (
          <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(59,130,246,0.04)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: timePref === 'specific' ? 10 : 0 }}>
              {TIME_PREFS.map(({ key, label, sub }) => {
                const active = timePref === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleTimePrefSelect(key)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 9,
                      border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                      background: active ? '#3B82F6' : '#fff',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#fff' : '#374151', lineHeight: 1 }}>{label}</div>
                    <div style={{ fontSize: 9, color: active ? 'rgba(255,255,255,0.75)' : '#94A3B8', marginTop: 2 }}>{sub}</div>
                  </button>
                );
              })}
            </div>

            {timePref === 'specific' && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>4-hour slots</p>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  {FOUR_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSpecificSlotSelect(key)}
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#3B82F6' : '#fff', color: active ? '#fff' : '#374151',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>2-hour slots</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {TWO_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSpecificSlotSelect(key)}
                        style={{
                          padding: '5px 8px', borderRadius: 7, fontSize: 10, fontWeight: 600,
                          border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#3B82F6' : '#fff', color: active ? '#fff' : '#374151',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Special notes ── */}
        {geocodeStatus === 'success' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
              Special Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              value={specialNotes}
              onChange={e => setSpecialNotes(e.target.value)}
              placeholder="e.g. call ahead, gate code, commercial account..."
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 10px', borderRadius: 9, resize: 'none',
                border: '1px solid rgba(0,0,0,0.1)', fontSize: 11, color: '#374151',
                background: '#f8fafc', outline: 'none', lineHeight: 1.4,
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(22,163,74,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
            />
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { name: 'Start Dashboard',           cmd: 'cd ~/green-shield-dashboard && bash start.sh' },
                { name: 'Login Script',               cmd: 'cd ~/green-shield-dashboard && node scripts/fieldRoutesLogin.mjs' },
                { name: 'Restart Server',            cmd: 'cd ~/green-shield-dashboard/server && npm start' },
              ].map(({ name, cmd }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0 }}>{name}</span>
                  <code style={{ fontSize: 9, color: '#475569', background: 'rgba(0,0,0,0.04)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{cmd}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No date selected hint ── */}
        {!activeDate && geocodeStatus === 'success' && (
          <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginBottom: 10 }}>
            Select a date above to see recommendations
          </p>
        )}

        {/* ── Auto-scoring loading indicator ── */}
        {scoringStatus === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#64748B', fontSize: 11 }}>
            <Loader2 size={12} className="animate-spin" style={{ color: '#16A34A' }} />
            Finding best routes...
          </div>
        )}

        {scoringStatus === 'error' && (
          <p style={{ fontSize: 11, color: '#DC2626', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> {scoringError}
          </p>
        )}

        {/* ── Results ── */}
        {scoringStatus === 'done' && results && (
          <div>
            {/* Route area header (NH / Maine) */}
            {results.routeArea && results.routeArea !== 'general' && (
              <div style={{
                marginBottom: 8, padding: '5px 10px', borderRadius: 8,
                background: results.routeArea === 'new_hampshire' ? 'rgba(59,130,246,0.06)' : 'rgba(139,92,246,0.06)',
                border: `1px solid ${results.routeArea === 'new_hampshire' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: results.routeArea === 'new_hampshire' ? '#3B82F6' : '#8B5CF6' }}>
                  {results.routeArea === 'new_hampshire' ? 'New Hampshire Route' : 'Maine Route'}
                </span>
                {results.routeArea === 'new_hampshire' && (
                  <span style={{ fontSize: 9, color: '#64748B' }}>Alex Gray only</span>
                )}
              </div>
            )}
            {/* No-safe-route message */}
            {results.noSafeRoute ? (
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', margin: 0, lineHeight: 1.4 }}>
                  {results.noSafeRouteMessage}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Top {results.topMatches.length} Matches
                  </p>
                  <button
                    onClick={() => runScore(activeTechnicians, geocode, timePref === 'specific' ? specificSlot : timePref ?? 'AT')}
                    style={{ fontSize: 10, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Re-score
                  </button>
                </div>
                {results.topMatches.map(match => (
                  <ResultCard key={match.routeId} match={match} rank={match.rank} routeArea={results.routeArea} />
                ))}
                <p style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>
                  {results.totalRoutesScored} routes scored · {results.prefWindow.label === 'AT' ? 'best available window' : `${results.prefWindow.startTime}–${results.prefWindow.endTime}`}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
